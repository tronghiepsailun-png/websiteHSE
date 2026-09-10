/**
 * One-time data import: parses the real "员工违规处罚名单" (5S violation) workbook the user
 * provided into Safety5sViolation rows, matching each row to its Employee by 工号
 * (employeeCode) so the department/position snapshot fields come from the live employee
 * record at import time.
 *
 * The source sheet stores fine amounts as thousands-of-VND (raw "200" is displayed as
 * "200.000" via a forced-3-decimal numFmt — the sheet's own shorthand for 200,000 ₫), so this
 * multiplies every raw amount by 1000 to get the real VND value stored in the DB.
 *
 * Safe to re-run: deletes any existing rows for the same org+period before inserting.
 * Run: npx tsx scripts/import-safety-5s-violations.ts
 */
import ExcelJS from "exceljs";
import { prisma } from "../src/lib/prisma";

const ORG_NAME = "CCG";
const SOURCE_PATH = "src/server/templates/safety-5s-violation-template.xlsx";
const SHEET_NAME = "2026.5";
const PERIOD_YEAR = 2026;
const PERIOD_MONTH = 5;
const FIRST_DATA_ROW = 4;
const FINE_RAW_MULTIPLIER = 1000;

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

async function main() {
  const org = await prisma.organization.findFirstOrThrow({ where: { name: ORG_NAME } });
  const employees = await prisma.employee.findMany({ where: { organizationId: org.id }, select: { id: true, employeeCode: true } });
  const employeeIdByCode = new Map(employees.map((e) => [e.employeeCode, e.id]));

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(SOURCE_PATH);
  const sheet = workbook.getWorksheet(SHEET_NAME);
  if (!sheet) throw new Error(`Sheet "${SHEET_NAME}" not found`);

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
    violationContent: string;
    violationDate: Date;
    fineAmountVnd: number | null;
    note: string | null;
  }[] = [];

  let r = FIRST_DATA_ROW;
  let noMatchCount = 0;
  while (true) {
    const row = sheet.getRow(r);
    const sttValue = row.getCell(1).value;
    if (sttValue === null || sttValue === undefined || sttValue === "") break;
    if (cellText(sttValue) === "合计") break;

    const employeeCode = cellText(row.getCell(2).value);
    const employeeId = employeeIdByCode.get(employeeCode) ?? null;
    if (!employeeId) {
      noMatchCount++;
      console.warn(`  row ${r}: no Employee match for 工号 "${employeeCode}" — importing without a link`);
    }

    const rawFine = row.getCell(13).value;
    const fineAmountVnd = rawFine === null || rawFine === undefined ? null : Number(rawFine) * FINE_RAW_MULTIPLIER;
    const violationDateValue = row.getCell(12).value;
    const violationDate = violationDateValue instanceof Date ? violationDateValue : new Date(String(violationDateValue));

    rowsToCreate.push({
      organizationId: org.id,
      periodYear: PERIOD_YEAR,
      periodMonth: PERIOD_MONTH,
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
      violationContent: cellText(row.getCell(11).value),
      violationDate,
      fineAmountVnd,
      note: cellText(row.getCell(14).value) || null,
    });
    r++;
  }

  if (rowsToCreate.length === 0) {
    console.log("No data rows found.");
    return;
  }

  await prisma.safety5sViolation.deleteMany({ where: { organizationId: org.id, periodYear: PERIOD_YEAR, periodMonth: PERIOD_MONTH } });
  await prisma.safety5sViolation.createMany({ data: rowsToCreate });
  console.log(`Imported ${rowsToCreate.length} rows (${noMatchCount} without an Employee match).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
