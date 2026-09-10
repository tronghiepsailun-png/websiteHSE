import ExcelJS from "exceljs";
import path from "node:path";
import { NextResponse } from "next/server";
import { requireApiAccess, withApiErrorHandling } from "@/server/api-guard";
import { PERMISSIONS } from "@/server/permissions";
import { listViolations, getSubsidyReport } from "@/server/violations";
import { contentDisposition } from "@/server/storage";

// This route loads the ORIGINAL reference workbook as a template and only overwrites data-cell
// VALUES at their known positions — every color/font/border/merge/column-width in the downloaded
// file comes straight from that template, untouched, so the export can't drift from "identical to
// the real report" the way the previous from-scratch ExcelJS reconstruction inevitably did (it
// approximated the same colors/fonts by hand and quietly drifted: wrong font family on sheet 2,
// slightly different title styling, etc).
const TEMPLATE_PATH = path.join(process.cwd(), "src/server/templates/safety-officer-violation-template.xlsx");
const SHEET1_NAME = "01.安全员考核表";
const SHEET2_NAME = "02.安全员补贴明细";
const SHEET1_COLS = 9; // A..I — 序号 through 备注
const SHEET2_COLS = 10; // A..J — TT through 实发
const SHEET1_FIRST_DATA_ROW = 3;
const SHEET2_FIRST_DATA_ROW = 3;
const SHEET1_ORIGINAL_TOTAL_ROW = 20;
const SHEET2_ORIGINAL_TOTAL_ROW = 29;

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
// individually — ExcelJS interns identical styles, so many cells across the template's original
// rows share the exact same style object by reference, and setting a sub-property mutates that
// shared object in place, silently reformatting every OTHER cell that happened to share it too
// (first found and worked around in the safety-5s-violation export route).
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

function deptOf(e: { orgUnitLevel1: string | null; orgUnitLevel2: string | null }) {
  return [e.orgUnitLevel1, e.orgUnitLevel2].filter(Boolean).join(" - ") || "";
}

/** Rebuilds the template's own mixed-font title run for sheet 1 ("2026" + "年" + "8" +
 *  "月安全员违规考核扣款登记表" + the Vietnamese line) for the requested year/month — every run's
 *  font is copied verbatim from the original file. */
function buildSheet1Title(year: number, month: number): ExcelJS.CellRichTextValue {
  const cjk: Partial<ExcelJS.Font> = { bold: true, size: 14, color: { theme: 1 }, name: "SimSun", charset: 134 };
  const num: Partial<ExcelJS.Font> = { bold: true, size: 14, color: { theme: 1 }, name: "Arial", charset: 134 };
  return {
    richText: [
      { font: num as ExcelJS.Font, text: String(year) },
      { font: cjk as ExcelJS.Font, text: "年" },
      { font: num as ExcelJS.Font, text: String(month) },
      { font: cjk as ExcelJS.Font, text: "月安全员违规考核扣款登记表" },
      { font: num as ExcelJS.Font, text: `\nBẢNG ĐÁNH GIÁ VI PHẠM & TRỪ TIỀN NHÂN VIÊN AN TOÀN XƯỞNG — Tháng ${month}/${year}` },
    ],
  };
}

/** Same idea for sheet 2's title ("8" + "月份安全员补贴名单" + the Vietnamese line). */
function buildSheet2Title(month: number): ExcelJS.CellRichTextValue {
  const num: Partial<ExcelJS.Font> = { bold: true, size: 16, name: "Arial", charset: 134 };
  const cjk: Partial<ExcelJS.Font> = { bold: true, size: 16, name: "Microsoft YaHei", charset: 134 };
  return {
    richText: [
      { font: num as ExcelJS.Font, text: String(month) },
      { font: cjk as ExcelJS.Font, text: "月份安全员补贴名单" },
      { font: num as ExcelJS.Font, text: `\nDANH SÁCH PHỤ CẤP NHÂN VIÊN AN TOÀN THÁNG ${month}` },
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

    const [violations, subsidy] = await Promise.all([
      listViolations(ctx.organizationId, { year, month }),
      getSubsidyReport(ctx.organizationId, { year, month }),
    ]);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(TEMPLATE_PATH);

    // ---- Sheet 1: violation log (01.安全员考核表) ----
    const ws1 = workbook.getWorksheet(SHEET1_NAME);
    if (!ws1) throw new Error("Export template sheet missing: " + SHEET1_NAME);

    const s1DataStyle = captureRowStyle(ws1, SHEET1_FIRST_DATA_ROW, SHEET1_COLS);
    const s1TotalStyle = captureRowStyle(ws1, SHEET1_ORIGINAL_TOTAL_ROW, SHEET1_COLS);
    const s1DataRowHeight = ws1.getRow(SHEET1_FIRST_DATA_ROW).height;
    ws1.unMergeCells(`A${SHEET1_ORIGINAL_TOTAL_ROW}:G${SHEET1_ORIGINAL_TOTAL_ROW}`);

    ws1.getCell("A1").value = buildSheet1Title(year, month);

    violations.forEach((v, i) => {
      const r = SHEET1_FIRST_DATA_ROW + i;
      const excelRow = ws1.getRow(r);
      const e = v.safetyOfficer.employee;
      excelRow.getCell(1).value = i + 1;
      excelRow.getCell(2).value = v.occurredAt;
      excelRow.getCell(3).value = /^\d+$/.test(e.employeeCode) ? Number(e.employeeCode) : e.employeeCode;
      excelRow.getCell(4).value = e.fullNameZh ?? "";
      excelRow.getCell(5).value = e.fullName;
      excelRow.getCell(6).value = deptOf(e);
      excelRow.getCell(7).value = v.violationType.labelZh ? `${v.violationType.labelZh}\n${v.violationType.labelVi}` : v.violationType.labelVi;
      excelRow.getCell(8).value = v.amountVnd;
      excelRow.getCell(9).value = v.note ?? "";
      applyRowStyle(ws1, r, s1DataStyle);
      excelRow.getCell(2).numFmt = "d/m/yyyy";
      if (s1DataRowHeight) excelRow.height = s1DataRowHeight;
    });

    const s1TotalRowNumber = SHEET1_FIRST_DATA_ROW + violations.length;
    const s1TotalRow = ws1.getRow(s1TotalRowNumber);
    s1TotalRow.getCell(1).value = "TỔNG CỘNG / 合计";
    for (let c = 2; c <= 7; c++) s1TotalRow.getCell(c).value = null;
    s1TotalRow.getCell(8).value = violations.length > 0 ? { formula: `SUM(H${SHEET1_FIRST_DATA_ROW}:H${s1TotalRowNumber - 1})` } : 0;
    s1TotalRow.getCell(9).value = null;
    applyRowStyle(ws1, s1TotalRowNumber, s1TotalStyle);
    ws1.mergeCells(`A${s1TotalRowNumber}:G${s1TotalRowNumber}`);

    const s1Rows = (ws1 as unknown as { _rows: unknown[] })._rows;
    if (s1Rows.length > s1TotalRowNumber) s1Rows.length = s1TotalRowNumber;

    // ---- Sheet 2: monthly subsidy report (02.安全员补贴明细) ----
    const ws2 = workbook.getWorksheet(SHEET2_NAME);
    if (!ws2) throw new Error("Export template sheet missing: " + SHEET2_NAME);

    const s2DataStyle = captureRowStyle(ws2, SHEET2_FIRST_DATA_ROW, SHEET2_COLS);
    const s2TotalStyle = captureRowStyle(ws2, SHEET2_ORIGINAL_TOTAL_ROW, SHEET2_COLS);
    const s2DataRowHeight = ws2.getRow(SHEET2_FIRST_DATA_ROW).height;
    ws2.unMergeCells(`A${SHEET2_ORIGINAL_TOTAL_ROW}:G${SHEET2_ORIGINAL_TOTAL_ROW}`);

    ws2.getCell("A1").value = buildSheet2Title(month);

    subsidy.rows.forEach((row, i) => {
      const r = SHEET2_FIRST_DATA_ROW + i;
      const excelRow = ws2.getRow(r);
      const e = row.safetyOfficer.employee;
      excelRow.getCell(1).value = i + 1;
      excelRow.getCell(2).value = /^\d+$/.test(e.employeeCode) ? Number(e.employeeCode) : e.employeeCode;
      excelRow.getCell(3).value = e.fullNameZh ?? "";
      excelRow.getCell(4).value = e.fullName;
      excelRow.getCell(5).value = deptOf(e);
      excelRow.getCell(6).value = e.region ?? "";
      excelRow.getCell(7).value = e.shift ?? "";
      excelRow.getCell(8).value = row.baseAmountVnd;
      excelRow.getCell(9).value = row.deductionVnd;
      excelRow.getCell(10).value = row.netAmountVnd;
      applyRowStyle(ws2, r, s2DataStyle);
      if (s2DataRowHeight) excelRow.height = s2DataRowHeight;
    });

    const s2TotalRowNumber = SHEET2_FIRST_DATA_ROW + subsidy.rows.length;
    const s2TotalRow = ws2.getRow(s2TotalRowNumber);
    s2TotalRow.getCell(1).value = "TỔNG CỘNG / 合计";
    for (let c = 2; c <= 7; c++) s2TotalRow.getCell(c).value = null;
    const hasSubsidyRows = subsidy.rows.length > 0;
    s2TotalRow.getCell(8).value = hasSubsidyRows ? { formula: `SUM(H${SHEET2_FIRST_DATA_ROW}:H${s2TotalRowNumber - 1})` } : 0;
    s2TotalRow.getCell(9).value = hasSubsidyRows ? { formula: `SUM(I${SHEET2_FIRST_DATA_ROW}:I${s2TotalRowNumber - 1})` } : 0;
    s2TotalRow.getCell(10).value = hasSubsidyRows ? { formula: `SUM(J${SHEET2_FIRST_DATA_ROW}:J${s2TotalRowNumber - 1})` } : 0;
    applyRowStyle(ws2, s2TotalRowNumber, s2TotalStyle);
    ws2.mergeCells(`A${s2TotalRowNumber}:G${s2TotalRowNumber}`);

    const s2Rows = (ws2 as unknown as { _rows: unknown[] })._rows;
    if (s2Rows.length > s2TotalRowNumber) s2Rows.length = s2TotalRowNumber;

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    const fileName = `Vi phạm an toàn viên tháng ${month}-${year}.xlsx`;

    return new NextResponse(arrayBuffer as ArrayBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": contentDisposition(fileName, "attachment"),
      },
    });
  });
}
