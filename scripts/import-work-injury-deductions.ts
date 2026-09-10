/**
 * One-time data import: parses the real "工伤连带责任人扣款名单" workbook the user provided
 * (one sheet per month, e.g. "2026年8月") into WorkInjuryDeduction rows for the "Vi phạm liên đế"
 * module, matching each row to its Employee by 工号 (employeeCode) so the department/position
 * snapshot fields come from the live employee record at import time.
 *
 * Safe to re-run: deletes any existing rows for the same org+period before inserting, so
 * re-running just re-imports the file cleanly instead of duplicating rows.
 * Run: npx tsx scripts/import-work-injury-deductions.ts
 */
import ExcelJS from "exceljs";
import { prisma } from "../src/lib/prisma";

const ORG_NAME = "CCG";
const SOURCE_PATH = "D:\\New folder (2)\\Đang làm\\8月份工伤连带责任人扣款名单.xlsx";

function parseSheetName(name: string): { year: number; month: number } | null {
  const m = name.match(/^(\d{4})年(\d{1,2})月$/);
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]) };
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    if ("text" in (value as Record<string, unknown>)) return String((value as { text: unknown }).text ?? "");
    if ("richText" in (value as Record<string, unknown>)) {
      const parts = (value as { richText: { text: string }[] }).richText;
      return parts.map((p) => p.text).join("");
    }
  }
  return String(value);
}

function parseAccidentDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const s = String(value).trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); // "d/m/yyyy", seen in the July sheet
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

async function main() {
  const org = await prisma.organization.findFirstOrThrow({ where: { name: ORG_NAME } });
  const employees = await prisma.employee.findMany({ where: { organizationId: org.id }, select: { id: true, employeeCode: true } });
  const employeeIdByCode = new Map(employees.map((e) => [e.employeeCode, e.id]));

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(SOURCE_PATH);

  let totalImported = 0;
  for (const sheet of workbook.worksheets) {
    const period = parseSheetName(sheet.name);
    if (!period) {
      console.log(`Skipping sheet "${sheet.name}" — name doesn't match YYYY年M月`);
      continue;
    }

    const rowsToCreate: {
      organizationId: string;
      periodYear: number;
      periodMonth: number;
      employeeId: string | null;
      employeeCodeSnapshot: string | null;
      fullNameZhSnapshot: string | null;
      fullNameViSnapshot: string;
      orgUnitLevel1Snapshot: string | null;
      regionSnapshot: string | null;
      orgUnitLevel2Snapshot: string | null;
      teamSnapshot: string | null;
      shiftSnapshot: string | null;
      positionSnapshot: string | null;
      accidentDate: Date | null;
      reporterName: string | null;
      fineAmountVnd: number;
    }[] = [];

    let r = 4; // rows 1-3 are the title + two-row header
    while (true) {
      const row = sheet.getRow(r);
      const sttValue = row.getCell(1).value;
      if (sttValue === null || sttValue === undefined || sttValue === "") break;
      if (cellText(sttValue) === "合计") break;

      const employeeCode = cellText(row.getCell(2).value);
      const employeeId = employeeIdByCode.get(employeeCode) ?? null;
      if (!employeeId) {
        console.warn(`  [${sheet.name}] row ${r}: no Employee match for 工号 "${employeeCode}" — importing without a link`);
      }

      rowsToCreate.push({
        organizationId: org.id,
        periodYear: period.year,
        periodMonth: period.month,
        employeeId,
        employeeCodeSnapshot: employeeCode || null,
        fullNameZhSnapshot: cellText(row.getCell(3).value) || null,
        fullNameViSnapshot: cellText(row.getCell(4).value),
        orgUnitLevel1Snapshot: cellText(row.getCell(5).value) || null,
        regionSnapshot: cellText(row.getCell(6).value) || null,
        orgUnitLevel2Snapshot: cellText(row.getCell(7).value) || null,
        teamSnapshot: cellText(row.getCell(8).value) || null,
        shiftSnapshot: cellText(row.getCell(9).value) || null,
        positionSnapshot: cellText(row.getCell(10).value) || null,
        accidentDate: parseAccidentDate(row.getCell(11).value),
        reporterName: cellText(row.getCell(12).value) || null,
        fineAmountVnd: Number(row.getCell(13).value) || 0,
      });
      r++;
    }

    if (rowsToCreate.length === 0) {
      console.log(`Sheet "${sheet.name}": no data rows found.`);
      continue;
    }

    await prisma.workInjuryDeduction.deleteMany({ where: { organizationId: org.id, periodYear: period.year, periodMonth: period.month } });
    await prisma.workInjuryDeduction.createMany({ data: rowsToCreate });
    console.log(`Sheet "${sheet.name}": imported ${rowsToCreate.length} rows.`);
    totalImported += rowsToCreate.length;
  }

  console.log(`Done. Imported ${totalImported} rows total.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
