import ExcelJS from "exceljs";
import path from "node:path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAccess, withApiErrorHandling } from "@/server/api-guard";
import { PERMISSIONS } from "@/server/permissions";
import { weekOfYear } from "@/lib/date";
import {
  getSheet02CrosstabData,
  getSheet03ScoreData,
  getSheet04DeductionData,
  getSheet05KpiData,
  buildSheet03NoteParts,
} from "@/server/incident-reports";
import { getIncidentFactoryCode, resolveEmployeeSnapshotNames, localizeEmployeeDisplayName } from "@/server/incidents";
import { contentDisposition } from "@/server/storage";
import { exportFileName } from "@/lib/format";

// This route loads the ORIGINAL reference workbook as a template and only overwrites data-cell
// VALUES at their known positions — every color/font/border/merge/column-width/frozen-pane in
// the downloaded file comes straight from that template, untouched, so the export can't drift
// from "100% identical" the way a from-scratch reconstruction inevitably would.
const TEMPLATE_PATH = path.join(process.cwd(), "src/server/templates/hse-monthly-report-template.xlsx");
const TEMPLATE_YEAR = 2026;

type CellStyleSnapshot = {
  font: Partial<ExcelJS.Font>;
  alignment: Partial<ExcelJS.Alignment>;
  border: Partial<ExcelJS.Borders>;
  fill: Partial<ExcelJS.Fill>;
  numFmt: string;
};

function captureRowStyle(ws: ExcelJS.Worksheet, rowNumber: number, colCount: number): CellStyleSnapshot[] {
  const row = ws.getRow(rowNumber);
  const styles: CellStyleSnapshot[] = [];
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c);
    styles.push({ font: cell.font, alignment: cell.alignment, border: cell.border, fill: cell.fill, numFmt: cell.numFmt });
  }
  return styles;
}

// A plain white fill, rebuilt fresh for every cell rather than reusing one captured object
// reference across all 380×19 cells: ExcelJS's shared-style interning gets confused when the
// exact same Fill object instance is assigned to many cells, and ends up randomly reassigning
// some of them a leftover peach/orange fill from the template's column-H (severity) styling —
// the unpredictable "column banding" the export used to show. A fresh literal per cell sidesteps
// that entirely. It also intentionally drops column H's original per-severity background color
// (baked into the template from whichever severity that template row historically had) instead
// of reproducing it against the live row's own (usually different) severity, which would be
// actively misleading, not just decorative.
function freshWhiteFill(): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { theme: 0 }, bgColor: { theme: 0 } } as ExcelJS.Fill;
}

// Assigns the whole `style` object in one go rather than setting cell.font/border/... one at a
// time: ExcelJS interns identical styles, so many cells across the template share the exact same
// style object by reference, and setting a sub-property mutates that shared object in place —
// silently reformatting every OTHER cell that happened to share it too (this is the same root
// cause freshWhiteFill() above already works around for fill specifically; font/alignment/border
// are just as exposed to it, so they get the same fresh-object treatment here).
function applyRowStyle(ws: ExcelJS.Worksheet, rowNumber: number, styles: CellStyleSnapshot[]) {
  const row = ws.getRow(rowNumber);
  styles.forEach((s, i) => {
    const cell = row.getCell(i + 1);
    cell.style = {
      font: s.font as ExcelJS.Font,
      alignment: s.alignment as ExcelJS.Alignment,
      border: s.border as ExcelJS.Borders,
      fill: freshWhiteFill(),
      numFmt: s.numFmt,
    };
  });
}

/** Sheet 03's monthly score cell carries the incidents that moved the score that month (same
 *  data the web UI shows as a hover tooltip) — mirrored here as an Excel cell note so the
 *  downloaded file is self-explanatory without needing to open the web app. */
function buildSheet03Note(cell: { delta: number; incidents: { incidentNumber: string; severityCode: string; description: string; occurredAt: Date }[] }): string | undefined {
  const note = buildSheet03NoteParts(cell);
  if (!note) return undefined;
  return `${note.summary}\n\n${note.lines.map((line) => `- ${line}`).join("\n")}`;
}

/** exceljs's `cell.note` setter has no "remove" counterpart — assigning `undefined` wraps it in
 *  a Note with an undefined payload instead of clearing it, which can serialize as a broken
 *  empty comment. Clearing the private backing field directly is the only way to fully remove
 *  a template's leftover note when the recomputed cell has nothing to explain. */
function setCellNote(cell: ExcelJS.Cell, note: string | undefined) {
  if (note) cell.note = note;
  else (cell as unknown as { _comment?: unknown })._comment = undefined;
}

/** Replaces the template's baked-in year (2026 / 2025) in every title/header cell of a sheet,
 *  a no-op when the requested year is the template's own year (the common case). */
function retitleYear(ws: ExcelJS.Worksheet, rowCount: number, colCount: number, year: number) {
  if (year === TEMPLATE_YEAR) return;
  for (let r = 1; r <= rowCount; r++) {
    for (let c = 1; c <= colCount; c++) {
      const cell = ws.getRow(r).getCell(c);
      if (typeof cell.value === "string") {
        cell.value = cell.value.replaceAll(String(TEMPLATE_YEAR), String(year)).replaceAll(String(TEMPLATE_YEAR - 1), String(year - 1));
      }
    }
  }
}

export async function GET(request: Request) {
  return withApiErrorHandling(async () => {
    const ctx = await requireApiAccess(PERMISSIONS.INCIDENT_DOWNLOAD);
    const url = new URL(request.url);
    const now = new Date();
    const year = Number(url.searchParams.get("year")) || now.getFullYear();

    const [sheet05Data, sheet04Data, sheet03Data, sheet02Data, incidents] = await Promise.all([
      getSheet05KpiData(ctx.organizationId, year),
      getSheet04DeductionData(ctx.organizationId, year),
      getSheet03ScoreData(ctx.organizationId, year),
      getSheet02CrosstabData(ctx.organizationId, year),
      prisma.incident.findMany({
        where: { organizationId: ctx.organizationId },
        include: { category: true, severity: true, orgUnit: true, employee: true, responsiblePerson: true },
        orderBy: { occurredAt: "asc" },
      }),
    ]);

    // Same "always Chinese" rule the incident list/detail pages already apply via
    // localizeEmployeeDisplayName — without this, an orphaned incident (no employee FK, only a
    // code snapshot) falls back to whatever raw employeeNameSnapshot text was captured, which is
    // Vietnamese for incidents entered by hand through the create form.
    const employeeSnapshotNamesByCode = await resolveEmployeeSnapshotNames(ctx.organizationId, incidents);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(TEMPLATE_PATH);

    // ---- Sheet 05: 工厂年度HSE目标 (rows 3-12, cols D-R = 4-18) ----
    {
      const ws = workbook.getWorksheet("05.工厂年度HSE目标")!;
      retitleYear(ws, 2, 18, year);
      sheet05Data.rows.forEach((row, i) => {
        const excelRow = ws.getRow(3 + i);
        excelRow.getCell(4).value = row.priorYearActual;
        excelRow.getCell(5).value =
          row.currentYearTarget === null
            ? ""
            : `${row.targetDisplayPrefix ?? ""}${row.unit === "%" ? `${row.currentYearTarget * 100}%` : row.currentYearTarget}`;
        excelRow.getCell(6).value = row.currentYearActual;
        row.monthly.forEach((v, m) => {
          excelRow.getCell(7 + m).value = m < sheet05Data.monthsElapsed ? v : null;
        });
      });
    }

    // ---- Sheet 04: 部门安全扣分 (rows 3-22 = 20 workshops, row 23 = total; cols D-S = 4-19) ----
    {
      const ws = workbook.getWorksheet("04.部门安全扣分")!;
      retitleYear(ws, 2, 19, year);
      sheet04Data.rows.forEach((row, i) => {
        const excelRow = ws.getRow(3 + i);
        excelRow.getCell(4).value = row.priorYearActual ?? "";
        excelRow.getCell(5).value = row.priorYearTarget ?? "";
        excelRow.getCell(6).value = row.currentYearTarget ?? "";
        excelRow.getCell(7).value = row.cumulative;
        row.monthly.forEach((v, m) => (excelRow.getCell(8 + m).value = v || ""));
      });
      const totalRow = ws.getRow(23);
      totalRow.getCell(7).value = sheet04Data.totalRow.cumulative;
      sheet04Data.totalRow.monthly.forEach((v, m) => (totalRow.getCell(8 + m).value = v || ""));
    }

    // ---- Sheet 03: 部门安全考核得分 (rows 4-23 = 20 workshops; cols D-O = 4-15) ----
    {
      const ws = workbook.getWorksheet("03.部门安全考核得分")!;
      retitleYear(ws, 3, 15, year);
      sheet03Data.rows.forEach((row, i) => {
        const excelRow = ws.getRow(4 + i);
        row.monthlyScores.forEach((cell, m) => {
          const excelCell = excelRow.getCell(4 + m);
          excelCell.value = cell.score;
          setCellNote(excelCell, buildSheet03Note(cell));
        });
        for (let m = row.monthlyScores.length; m < 12; m++) {
          const excelCell = excelRow.getCell(4 + m);
          excelCell.value = null;
          setCellNote(excelCell, undefined);
        }
      });
    }

    // ---- Sheet 02: 部门事件统计 (rows 3-9 = 7 severity rows, row 10 = total; cols D-Y = 4-25) ----
    {
      const ws = workbook.getWorksheet("02.部门事件统计")!;
      retitleYear(ws, 2, 25, year);
      const SEVERITY_TEMPLATE_ROWS = ["A1", "A2", "B", "C", "D", "E", "F"];
      for (let i = 0; i < SEVERITY_TEMPLATE_ROWS.length; i++) {
        const code = SEVERITY_TEMPLATE_ROWS[i];
        // The live severity catalog has no A1/A2 split — "A" data (if the org has an "A"
        // severity) is written into the milder A1 slot; A2 (and E/F, if undefined) get zeroed
        // rather than left showing the template's stale historical numbers.
        const match = code === "A1" ? sheet02Data.rows.find((r) => r.severityCode === "A") : sheet02Data.rows.find((r) => r.severityCode === code);
        const excelRow = ws.getRow(3 + i);
        excelRow.getCell(3).value = year;
        for (let c = 0; c < sheet02Data.columns.length; c++) {
          excelRow.getCell(4 + c).value = match ? match.cells[c] || "" : 0;
        }
        excelRow.getCell(4 + sheet02Data.columns.length).value = match ? match.rowTotal : 0;
      }
      const totalRow = ws.getRow(10);
      totalRow.getCell(3).value = year;
      sheet02Data.totalsByColumn.forEach((v, c) => (totalRow.getCell(4 + c).value = v || ""));
      totalRow.getCell(4 + sheet02Data.totalsByColumn.length).value = sheet02Data.grandTotal;
    }

    // ---- Sheet 01: 事件明细表 (raw incident log — variable row count) ----
    {
      const ws = workbook.getWorksheet("01.事件明细表")!;
      const COLS = 19;
      const styleTemplate = captureRowStyle(ws, 2, COLS);

      incidents.forEach((incident, i) => {
        const r = 2 + i;
        const excelRow = ws.getRow(r);
        const factoryCode = getIncidentFactoryCode(incident);
        excelRow.getCell(1).value = incident.occurredAt.getFullYear();
        excelRow.getCell(2).value = incident.occurredAt.getMonth() + 1;
        excelRow.getCell(3).value = weekOfYear(incident.occurredAt);
        excelRow.getCell(4).value = factoryCode === "—" ? "" : factoryCode;
        excelRow.getCell(5).value = incident.incidentNumber;
        excelRow.getCell(6).value = incident.orgUnit?.name ?? incident.departmentSnapshot ?? "";
        excelRow.getCell(7).value = incident.occurredAt;
        excelRow.getCell(8).value = incident.severity.code;
        excelRow.getCell(9).value = incident.description;
        excelRow.getCell(10).value = incident.correctiveAction ?? "";
        excelRow.getCell(11).value = incident.responsiblePerson?.fullNameZh ?? incident.responsiblePerson?.fullName ?? incident.responsiblePersonNameSnapshot ?? "";
        excelRow.getCell(12).value = localizeEmployeeDisplayName(incident, employeeSnapshotNamesByCode);
        excelRow.getCell(13).value = incident.locationDetail ?? "";
        excelRow.getCell(14).value = incident.costRmb ?? "";
        excelRow.getCell(15).value = incident.costVnd ?? incident.cost ?? "";
        excelRow.getCell(16).value = incident.pointsDeducted ?? "";
        excelRow.getCell(17).value = incident.injuredBodyPart ?? "";
        excelRow.getCell(18).value = incident.category.name;
        excelRow.getCell(19).value = incident.notes ?? "";
        applyRowStyle(ws, r, styleTemplate);
        excelRow.getCell(7).numFmt = "d/m/yyyy";
      });

      // Remove whatever old rows the template had beyond the live data — the export always
      // reflects the app's current data, never stale template contents. `ws.spliceRows` silently
      // no-ops here: its internal "shift remaining rows down" loop never runs when the deleted
      // range reaches all the way to the last existing row (an off-by-bounds bug in exceljs), so
      // it never actually dropped the ~1000 blank trailing template rows. Truncating the row
      // array directly is the one reliable way to remove them.
      const lastNeededRow = 1 + incidents.length;
      const rows = (ws as unknown as { _rows: unknown[] })._rows;
      if (rows.length > lastNeededRow) {
        rows.length = lastNeededRow;
      }
    }

    // The template's data-validation dropdowns (one per cell, thousands of them) reference a
    // named range/sheet that no longer resolves correctly, so Excel flags every cell we write
    // as "Giá trị không hợp lệ" even though the value is correct — the export always writes
    // valid values programmatically, so these leftover manual-entry dropdowns serve no purpose
    // here and are stripped from every sheet before the file is written.
    for (const ws of workbook.worksheets) {
      (ws as unknown as { dataValidations: { model: Record<string, unknown> } }).dataValidations.model = {};
    }

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    const fileName = `${exportFileName("Danh sách sự cố và khảo hạch")}.xlsx`;

    return new NextResponse(arrayBuffer as ArrayBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": contentDisposition(fileName, "attachment"),
      },
    });
  });
}
