import type ExcelJS from "exceljs";
import type { DictionaryKey } from "@/lib/i18n/translate";

/** Fixed column order/names shared by the export route and the blank template route,
 *  so the two files can never drift apart. Order mirrors the original spreadsheet's
 *  field order the user specified (工号 → … → 职位), with the platform-only `status`
 *  field appended after — same "original structure first, platform fields after"
 *  convention as src/app/api/incidents/export/route.ts. */
export function employeeExportColumns(tr: (key: DictionaryKey) => string): Partial<ExcelJS.Column>[] {
  return [
    { header: tr("employees.field.employeeCode"), key: "employeeCode", width: 12 },
    { header: tr("employees.field.fullNameZh"), key: "fullNameZh", width: 16 },
    { header: tr("employees.field.fullName"), key: "fullName", width: 22 },
    { header: tr("employees.field.gender"), key: "gender", width: 10 },
    { header: tr("employees.field.education"), key: "education", width: 12 },
    { header: tr("employees.field.birthDate"), key: "birthDate", width: 14, style: { numFmt: "dd/mm/yyyy" } },
    { header: tr("employees.field.nationalId"), key: "nationalId", width: 16 },
    { header: tr("employees.field.orgUnitLevel1"), key: "orgUnitLevel1", width: 18 },
    { header: tr("employees.field.region"), key: "region", width: 12 },
    { header: tr("employees.field.costCenterName"), key: "costCenterName", width: 20 },
    { header: tr("employees.field.orgUnitLevel2"), key: "orgUnitLevel2", width: 18 },
    { header: tr("employees.field.team"), key: "team", width: 14 },
    { header: tr("employees.field.shift"), key: "shift", width: 14 },
    { header: tr("employees.field.position"), key: "position", width: 16 },
    { header: tr("common.status"), key: "status", width: 14 },
  ];
}
