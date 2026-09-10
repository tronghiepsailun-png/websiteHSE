/**
 * One-time data import: parses "8月份5S处罚名单.xlsx" (sheet "2026.8") into Safety5sViolation
 * rows for August 2026, matching each row to its Employee by 工号 (employeeCode).
 *
 * Date-column quirk found in this source file: cells stored as a real Excel Date have their
 * day-of-month and month swapped (e.g. "4 August" got saved as a date object reading
 * "April 8") — confirmed by cross-checking against the sheet's own plain-text date cells
 * (e.g. "15/8/2026", "24/8/2026": unambiguous DD/MM/YYYY, since 15/24 can't be a month) which
 * all land in August, while every Date-typed cell's day-of-month component is consistently the
 * sheet's own month (8) with the month component varying — i.e. exactly the swapped pair. Both
 * forms are normalized back to true DD/MM/YYYY here. A run-time check aborts if any parsed row
 * lands outside the target period, so a bad assumption fails loudly instead of importing silently
 * wrong dates.
 *
 * Fine amounts in this sheet are already plain VND (unlike the older template sheets, which used
 * a ×1000 shorthand) — no multiplier applied.
 *
 * Safe to re-run: deletes any existing rows for the same org+period before inserting.
 * Run: npx tsx scripts/import-safety-5s-violations-aug2026.ts
 */
import ExcelJS from "exceljs";
import { prisma } from "../src/lib/prisma";

const ORG_NAME = "CCG";
const SOURCE_PATH = "D:/New folder/8月份5S处罚名单.xlsx";
const SHEET_NAME = "2026.8";
const PERIOD_YEAR = 2026;
const PERIOD_MONTH = 8;
const FIRST_DATA_ROW = 4;

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && !(value instanceof Date)) {
    if ("text" in (value as Record<string, unknown>)) return String((value as { text: unknown }).text ?? "");
    if ("richText" in (value as Record<string, unknown>)) {
      const parts = (value as { richText: { text: string }[] }).richText;
      return parts.map((p) => p.text).join("");
    }
  }
  return String(value);
}

function parseViolationDate(raw: unknown): Date {
  if (raw instanceof Date) {
    // Swapped day/month, per the file-wide pattern documented above.
    const trueDay = raw.getUTCMonth() + 1;
    const trueMonth = raw.getUTCDate();
    return new Date(Date.UTC(raw.getUTCFullYear(), trueMonth - 1, trueDay));
  }
  const str = cellText(raw).trim();
  const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) throw new Error(`Unparseable violation date: ${JSON.stringify(raw)}`);
  const [, d, mo, y] = m;
  return new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
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
    const fineAmountVnd = rawFine === null || rawFine === undefined ? null : Number(rawFine);
    const violationDate = parseViolationDate(row.getCell(12).value);
    if (violationDate.getUTCFullYear() !== PERIOD_YEAR || violationDate.getUTCMonth() + 1 !== PERIOD_MONTH) {
      throw new Error(`row ${r}: parsed date ${violationDate.toISOString()} falls outside ${PERIOD_YEAR}-${PERIOD_MONTH} — date-swap assumption may not hold for this row, aborting`);
    }

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
  console.log("Total fine:", rowsToCreate.reduce((s, r) => s + (r.fineAmountVnd ?? 0), 0));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
