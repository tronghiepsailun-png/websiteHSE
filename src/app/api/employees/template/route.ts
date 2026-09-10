import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { requireApiAccess, withApiErrorHandling } from "@/server/api-guard";
import { PERMISSIONS } from "@/server/permissions";
import { getLocale } from "@/lib/i18n/get-locale.server";
import { t, type DictionaryKey } from "@/lib/i18n/translate";
import { employeeExportColumns } from "@/server/employee-export-columns";
import { contentDisposition } from "@/server/storage";

export async function GET() {
  return withApiErrorHandling(async () => {
    await requireApiAccess(PERMISSIONS.EMPLOYEE_VIEW);
    const locale = await getLocale();
    const tr = (key: DictionaryKey) => t(locale, key);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "HSE Management Platform";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet(tr("employees.moduleName").slice(0, 31) || "Employees");
    sheet.columns = employeeExportColumns(tr).filter((c) => c.key !== "status"); // status is platform-only, not an import field
    sheet.getRow(1).font = { bold: true };

    const arrayBuffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(arrayBuffer as ArrayBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": contentDisposition("Mẫu_Danh sách nhân viên.xlsx", "attachment"),
      },
    });
  });
}
