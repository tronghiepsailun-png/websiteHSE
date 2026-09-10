import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAccess, withApiErrorHandling } from "@/server/api-guard";
import { PERMISSIONS } from "@/server/permissions";
import { getLocale } from "@/lib/i18n/get-locale.server";
import { t, type DictionaryKey } from "@/lib/i18n/translate";
import { employeeExportColumns } from "@/server/employee-export-columns";
import { contentDisposition } from "@/server/storage";

export async function GET() {
  return withApiErrorHandling(async () => {
    const ctx = await requireApiAccess(PERMISSIONS.EMPLOYEE_DOWNLOAD);
    const locale = await getLocale();
    const tr = (key: DictionaryKey) => t(locale, key);

    const employees = await prisma.employee.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: { employeeCode: "asc" },
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "HSE Management Platform";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet(tr("employees.moduleName").slice(0, 31) || "Employees", {
      views: [{ state: "frozen", ySplit: 1 }],
    });

    sheet.columns = employeeExportColumns(tr);
    sheet.getRow(1).font = { bold: true };

    for (const e of employees) {
      sheet.addRow({
        employeeCode: e.employeeCode,
        fullNameZh: e.fullNameZh ?? "",
        fullName: e.fullName,
        gender: e.gender ? t(locale, `employees.gender.${e.gender}` as DictionaryKey) : "",
        education: e.education ?? "",
        birthDate: e.birthDate,
        nationalId: e.nationalId ?? "",
        orgUnitLevel1: e.orgUnitLevel1 ?? "",
        region: e.region ?? "",
        costCenterName: e.costCenterName ?? "",
        orgUnitLevel2: e.orgUnitLevel2 ?? "",
        team: e.team ?? "",
        shift: e.shift ?? "",
        position: e.position ?? "",
        status: t(locale, `employees.status.${e.status}` as DictionaryKey),
      });
    }

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    const fileDate = new Date().toISOString().slice(0, 10);
    const fileName = `Danh sách nhân viên ${fileDate}.xlsx`;

    return new NextResponse(arrayBuffer as ArrayBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": contentDisposition(fileName, "attachment"),
      },
    });
  });
}
