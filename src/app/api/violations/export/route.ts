import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { requireApiAccess, withApiErrorHandling } from "@/server/api-guard";
import { PERMISSIONS } from "@/server/permissions";
import { listViolations, getSubsidyReport } from "@/server/violations";

// Colors/fonts/column widths/number formats below are copied verbatim from the reference
// workbook this module replaces ("Biểu khảo hạch ATV tháng 8 - v1.xlsx") so a downloaded
// file needs no re-formatting before being sent to leadership.
const GREEN_DARK = "FF4E8325";
const GREEN_MID = "FF78AC30";
const BORDER_GRAY = "FFD9D4C4";
const BLUE_HEADER = "FFB7DDE8";
const BLUE_TOTAL = "FFDBEEF3";

const ARIAL_WHITE_BOLD = (size: number): Partial<ExcelJS.Font> => ({ name: "Arial", size, bold: true, color: { argb: "FFFFFFFF" } });
const ARIAL_WHITE = (size: number): Partial<ExcelJS.Font> => ({ name: "Arial", size, color: { argb: "FFFFFFFF" } });
const ARIAL_DATA: Partial<ExcelJS.Font> = { name: "Arial", size: 10, color: { argb: "FF3A3A30" } };
const CENTER_WRAP: Partial<ExcelJS.Alignment> = { horizontal: "center", vertical: "middle", wrapText: true };
const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: BORDER_GRAY } },
  bottom: { style: "thin", color: { argb: BORDER_GRAY } },
  left: { style: "thin", color: { argb: BORDER_GRAY } },
  right: { style: "thin", color: { argb: BORDER_GRAY } },
};
const SOLID = (argb: string): ExcelJS.Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb } });

function deptOf(e: { orgUnitLevel1: string | null; orgUnitLevel2: string | null }) {
  return [e.orgUnitLevel1, e.orgUnitLevel2].filter(Boolean).join(" - ") || "";
}

export async function GET(request: Request) {
  return withApiErrorHandling(async () => {
    const ctx = await requireApiAccess(PERMISSIONS.VIOLATION_VIEW);
    const url = new URL(request.url);
    const now = new Date();
    const year = Number(url.searchParams.get("year")) || now.getFullYear();
    const month = Number(url.searchParams.get("month")) || now.getMonth() + 1;

    const [violations, subsidy] = await Promise.all([
      listViolations(ctx.organizationId, { year, month }),
      getSubsidyReport(ctx.organizationId, { year, month }),
    ]);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "HSE Management Platform";
    workbook.created = new Date();

    // ---- Sheet 1: violation log (mirrors "01.安全员考核表") ----
    const sheet1 = workbook.addWorksheet("01.安全员考核表", {
      views: [{ state: "frozen", ySplit: 2, showGridLines: false }],
      pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, horizontalCentered: true },
      properties: { tabColor: { argb: GREEN_MID } },
    });
    sheet1.columns = [
      { width: 6 }, { width: 12 }, { width: 10 }, { width: 26 }, { width: 19.7 },
      { width: 30 }, { width: 44 }, { width: 16 }, { width: 22 },
    ];

    sheet1.mergeCells("A1:I1");
    const title1 = sheet1.getCell("A1");
    title1.value = `安全员违规考核扣款登记表\nBẢNG ĐÁNH GIÁ VI PHẠM & TRỪ TIỀN NHÂN VIÊN AN TOÀN XƯỞNG — Tháng ${month}/${year}`;
    title1.font = ARIAL_WHITE_BOLD(14);
    title1.alignment = CENTER_WRAP;
    title1.fill = SOLID(GREEN_DARK);
    sheet1.getRow(1).height = 42;

    const headers1 = [
      "序号\nSTT", "日期\nNGÀY THÁNG", "工号\nMSNV", "中文\nHỌ TÊN (Trung)", "越文\nHỌ VÀ TÊN (Việt)",
      "部门/区域\nBỘ PHẬN/KHU VỰC", "考核内容（违规情况）\nNỘI DUNG ĐÁNH GIÁ (VI PHẠM)",
      "扣款金额(VNĐ)\nSỐ TIỀN BỊ TRỪ", "备注\nGHI CHÚ",
    ];
    const headerRow = sheet1.getRow(2);
    headers1.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.font = ARIAL_WHITE(10);
      cell.alignment = CENTER_WRAP;
      cell.fill = SOLID(GREEN_MID);
    });
    headerRow.height = 32;

    let r = 3;
    for (const v of violations) {
      const row = sheet1.getRow(r);
      const e = v.safetyOfficer.employee;
      row.getCell(1).value = r - 2;
      row.getCell(2).value = v.occurredAt;
      row.getCell(2).numFmt = "d/m/yyyy";
      row.getCell(3).value = e.employeeCode;
      row.getCell(4).value = e.fullNameZh ?? "";
      row.getCell(5).value = e.fullName;
      row.getCell(6).value = deptOf(e);
      row.getCell(7).value = v.violationType.labelZh ? `${v.violationType.labelZh}\n${v.violationType.labelVi}` : v.violationType.labelVi;
      row.getCell(8).value = v.amountVnd;
      row.getCell(8).numFmt = `#,##0" đ"`;
      row.getCell(9).value = v.note ?? "";
      for (let c = 1; c <= 9; c++) {
        const cell = row.getCell(c);
        cell.font = ARIAL_DATA;
        cell.alignment = CENTER_WRAP;
        cell.border = THIN_BORDER;
        if (c === 6 || c === 7 || c === 9) cell.alignment = { ...CENTER_WRAP, horizontal: "left" };
      }
      row.height = 30;
      r++;
    }

    const totalRow = sheet1.getRow(r);
    totalRow.getCell(7).value = "TỔNG CỘNG / 合计";
    totalRow.getCell(7).font = ARIAL_WHITE_BOLD(11);
    totalRow.getCell(7).alignment = { horizontal: "right", vertical: "middle" };
    totalRow.getCell(8).value = violations.reduce((s, v) => s + v.amountVnd, 0);
    totalRow.getCell(8).numFmt = `#,##0" đ"`;
    for (let c = 1; c <= 9; c++) {
      const cell = totalRow.getCell(c);
      cell.fill = SOLID(GREEN_DARK);
      cell.border = THIN_BORDER;
      if (c === 8) {
        cell.font = ARIAL_WHITE_BOLD(12);
        cell.alignment = { horizontal: "center", vertical: "middle" };
      }
    }
    totalRow.height = 24;

    // ---- Sheet 2: monthly subsidy report (mirrors "02.安全员补贴明细") ----
    const sheet2 = workbook.addWorksheet("02.安全员补贴明细", {
      views: [{ state: "frozen", ySplit: 1, showGridLines: false }],
      pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, horizontalCentered: true },
      properties: { tabColor: { argb: BLUE_HEADER } },
    });
    sheet2.columns = [
      { width: 6 }, { width: 11 }, { width: 16 }, { width: 27 }, { width: 24 },
      { width: 12 }, { width: 8 }, { width: 15 }, { width: 15 }, { width: 15 },
    ];

    sheet2.mergeCells("A1:J1");
    const title2 = sheet2.getCell("A1");
    title2.value = `DANH SÁCH PHỤ CẤP NHÂN VIÊN AN TOÀN THÁNG ${month}\n${month}月份安全员补贴名单`;
    title2.font = { name: "Times New Roman", size: 12, bold: true };
    title2.alignment = CENTER_WRAP;
    sheet2.getRow(1).height = 34;

    const headers2 = [
      "TT\n序号", "MSNV\n工号", "中文\nHỌ TÊN (Trung)", "越文\nHỌ VÀ TÊN (Việt)", "BỘ PHẬN\n部门",
      "Khu vực\n区域", "班组\nCa", "SỐ TIỀN (VNĐ)\n金额", "TRỪ TIỀN\n扣款", "THỰC NHẬN\n实发",
    ];
    const headerRow2 = sheet2.getRow(2);
    headers2.forEach((h, i) => {
      const cell = headerRow2.getCell(i + 1);
      cell.value = h;
      cell.font = { name: "Times New Roman", size: 11, bold: true };
      cell.alignment = CENTER_WRAP;
      cell.fill = SOLID(BLUE_HEADER);
    });
    headerRow2.height = 30;

    let r2 = 3;
    for (const row of subsidy.rows) {
      const e = row.safetyOfficer.employee;
      const excelRow = sheet2.getRow(r2);
      excelRow.getCell(1).value = r2 - 2;
      excelRow.getCell(2).value = e.employeeCode;
      excelRow.getCell(3).value = e.fullNameZh ?? "";
      excelRow.getCell(4).value = e.fullName;
      excelRow.getCell(5).value = deptOf(e);
      excelRow.getCell(6).value = e.region ?? "";
      excelRow.getCell(7).value = e.shift ?? "";
      excelRow.getCell(8).value = row.baseAmountVnd;
      excelRow.getCell(9).value = row.deductionVnd;
      excelRow.getCell(10).value = row.netAmountVnd;
      for (let c = 1; c <= 10; c++) {
        const cell = excelRow.getCell(c);
        cell.font = { name: "Times New Roman", size: 11 };
        cell.alignment = c >= 3 && c <= 5 ? { ...CENTER_WRAP, horizontal: "left" } : CENTER_WRAP;
        if (c >= 8) cell.numFmt = "#,##0";
      }
      excelRow.height = 20;
      r2++;
    }

    const totalRow2 = sheet2.getRow(r2);
    sheet2.mergeCells(`A${r2}:G${r2}`);
    totalRow2.getCell(1).value = "TỔNG CỘNG / 合计";
    totalRow2.getCell(8).value = subsidy.totalBaseVnd;
    totalRow2.getCell(9).value = subsidy.totalDeductionVnd;
    totalRow2.getCell(10).value = subsidy.totalNetVnd;
    for (let c = 1; c <= 10; c++) {
      const cell = totalRow2.getCell(c);
      cell.font = { name: "Times New Roman", size: 11, bold: true };
      cell.fill = SOLID(BLUE_TOTAL);
      cell.alignment = c === 1 ? { horizontal: "center", vertical: "middle" } : CENTER_WRAP;
      if (c >= 8) cell.numFmt = "#,##0";
    }
    totalRow2.height = 22;

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    const fileName = `vi-pham-atv-thang-${month}-${year}.xlsx`;

    return new NextResponse(arrayBuffer as ArrayBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  });
}
