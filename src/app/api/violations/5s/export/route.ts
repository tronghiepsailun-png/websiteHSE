import ExcelJS from "exceljs";
import path from "node:path";
import { NextResponse } from "next/server";
import { requireApiAccess, withApiErrorHandling } from "@/server/api-guard";
import { PERMISSIONS } from "@/server/permissions";
import { contentDisposition } from "@/server/storage";
import { listSafety5sViolations } from "@/server/safety-5s-violations";

// This route loads the ORIGINAL workbook the user provided as a template and only overwrites
// data-cell VALUES at their known positions — every font/border/fill/merge/column-width in the
// downloaded file comes straight from that template, untouched (see the lien-de export route
// for the same pattern, first established there).
const TEMPLATE_PATH = path.join(process.cwd(), "src/server/templates/safety-5s-violation-template.xlsx");
const TEMPLATE_SHEET_NAME = "2026.5";
const DATA_COLS = 14; // A..N — 序号 through 备注
const FIRST_DATA_ROW = 4; // rows 1-3 are the title + two-row grouped header
const ORIGINAL_TOTAL_ROW = 65; // where the template's own "合计" row/merge originally sat
const DATA_ROW_HEIGHT = 18;
const TOTAL_ROW_HEIGHT = 42;

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

// Assigns the whole `style` object in one go rather than setting cell.font/fill/border/...
// individually: ExcelJS interns identical styles, so many cells across the template's original
// 61 rows share the exact same style object by reference. Setting a sub-property (e.g.
// `cell.fill = x`) mutates that shared object in place, silently reformatting every OTHER cell
// that happened to share it too (this is exactly how the fine-amount column's yellow highlight
// on one row leaked backward onto unrelated rows). A fresh `style` object per cell severs the
// sharing before anything gets mutated.
function applyRowStyle(ws: ExcelJS.Worksheet, rowNumber: number, styles: CellStyleSnapshot[]) {
  const row = ws.getRow(rowNumber);
  styles.forEach((s, i) => {
    const cell = row.getCell(i + 1);
    cell.style = {
      font: s.font as ExcelJS.Font,
      alignment: s.alignment as ExcelJS.Alignment,
      border: s.border as ExcelJS.Borders,
      fill: s.fill as ExcelJS.Fill,
      numFmt: s.numFmt,
    };
  });
}

/** Rebuilds the template's own mixed-font title run ("2026" + "年" + "5" + "月员工违规处罚名单")
 *  for the requested year/month — every run's font is copied verbatim from the original file. */
function buildTitleRichText(year: number, month: number): ExcelJS.CellRichTextValue {
  const base: Partial<ExcelJS.Font> = { size: 18, color: { theme: 1 }, name: "Calibri", charset: 134 };
  const cjk: Partial<ExcelJS.Font> = { size: 18, color: { theme: 1 }, name: "SimSun", charset: 134 };
  return {
    richText: [
      { font: base as ExcelJS.Font, text: String(year) },
      { font: cjk as ExcelJS.Font, text: "年" },
      { font: base as ExcelJS.Font, text: String(month) },
      { font: cjk as ExcelJS.Font, text: "月员工违规处罚名单" },
    ],
  };
}

export async function GET(request: Request) {
  return withApiErrorHandling(async () => {
    const ctx = await requireApiAccess(PERMISSIONS.VIOLATION_DOWNLOAD);
    const url = new URL(request.url);
    const now = new Date();
    const year = Number(url.searchParams.get("year")) || now.getFullYear();
    const month = Number(url.searchParams.get("month")) || now.getMonth() + 1;

    const rows = await listSafety5sViolations(ctx.organizationId, { year, month });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(TEMPLATE_PATH);

    const ws = workbook.getWorksheet(TEMPLATE_SHEET_NAME);
    if (!ws) throw new Error("Export template sheet missing");

    // Keep exactly one sheet in the exported file — always the requested period, never
    // whichever other month/scratch sheets happen to exist in the template.
    for (const sheet of workbook.worksheets) {
      if (sheet.id !== ws.id) workbook.removeWorksheet(sheet.id);
    }
    ws.name = `${year}.${month}`;

    const dataStyle = captureRowStyle(ws, FIRST_DATA_ROW, DATA_COLS);
    const totalStyle = captureRowStyle(ws, ORIGINAL_TOTAL_ROW, DATA_COLS);
    // The template's own total row is a merge (A:L) at a fixed row — remove it before writing
    // real data over that row and re-merging the label at wherever the total row actually ends
    // up once this period's real row count is known.
    ws.unMergeCells(`A${ORIGINAL_TOTAL_ROW}:L${ORIGINAL_TOTAL_ROW}`);

    ws.getCell("A1").value = buildTitleRichText(year, month);

    rows.forEach((row, i) => {
      const r = FIRST_DATA_ROW + i;
      const excelRow = ws.getRow(r);
      excelRow.getCell(1).value = i + 1;
      const code = row.employeeCodeSnapshot ?? "";
      excelRow.getCell(2).value = /^\d+$/.test(code) ? Number(code) : code;
      excelRow.getCell(3).value = row.fullNameZhSnapshot ?? "";
      excelRow.getCell(4).value = row.fullNameViSnapshot;
      excelRow.getCell(5).value = row.orgUnitLevel1Snapshot ?? "";
      excelRow.getCell(6).value = row.regionSnapshot ?? "";
      excelRow.getCell(7).value = row.orgUnitLevel2Snapshot ?? "";
      excelRow.getCell(8).value = row.teamSnapshot ?? "";
      excelRow.getCell(9).value = row.shiftSnapshot ?? "";
      excelRow.getCell(10).value = row.positionSnapshot ?? "";
      excelRow.getCell(11).value = row.violationContent;
      excelRow.getCell(12).value = row.violationDate;
      excelRow.getCell(13).value = row.fineAmountVnd;
      excelRow.getCell(14).value = row.note ?? "";
      applyRowStyle(ws, r, dataStyle);
      excelRow.getCell(12).numFmt = "yyyy-m-d";
      // The template's own numFmt for this column ("#,##0.000") is the shorthand-thousands
      // display trick from the ORIGINAL sample file — not what we want here, since the DB (and
      // this export) always writes the real, full VND amount. Plain grouping only.
      excelRow.getCell(13).numFmt = "#,##0";
      excelRow.height = DATA_ROW_HEIGHT;
    });

    const totalRowNumber = FIRST_DATA_ROW + rows.length;
    const totalRow = ws.getRow(totalRowNumber);
    totalRow.getCell(1).value = "合计";
    // Clear every column but the label (1) and the fine-amount total (13) — this row number
    // is reused from the template, which may have held a real data row here (e.g. exporting a
    // month with fewer rows than the template originally had), so stale values must not leak
    // through into the total row.
    for (let c = 2; c <= DATA_COLS; c++) totalRow.getCell(c).value = null;
    totalRow.getCell(13).value = rows.length > 0 ? { formula: `SUM(M${FIRST_DATA_ROW}:M${totalRowNumber - 1})` } : 0;
    applyRowStyle(ws, totalRowNumber, totalStyle);
    totalRow.getCell(13).numFmt = "#,##0";
    ws.mergeCells(`A${totalRowNumber}:L${totalRowNumber}`);
    totalRow.height = TOTAL_ROW_HEIGHT;

    // Drop whatever stray trailing rows the template still carries beyond the total row —
    // the export always reflects the live data for this period, never leftover template rows.
    const rowsArray = (ws as unknown as { _rows: unknown[] })._rows;
    if (rowsArray.length > totalRowNumber) rowsArray.length = totalRowNumber;

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    const fileName = `${month}月份5S处罚名单.xlsx`;

    return new NextResponse(arrayBuffer as ArrayBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": contentDisposition(fileName, "attachment"),
      },
    });
  });
}
