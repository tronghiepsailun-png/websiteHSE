import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import type { DictionaryKey } from "@/lib/i18n/translate";
import {
  type ClassifiedEmployeeRow,
  type DepartedEmployee,
  type EmployeeImportCommitResult,
  type EmployeeImportPreview,
  type FieldDiff,
  type ParsedEmployeeFields,
  FIELD_LABEL_KEYS,
} from "@/server/employee-import-shared";

// ─────────────────────────────────────────────────────────────────────────
// HR's monthly roster export is always the same workbook shape: a sheet
// literally named 在职 ("currently employed") holding the live roster, plus a
// handful of other sheets (departed staff, interns, temp badge swaps, ...)
// that must never be read as if they were current employees. Earlier this
// scanned every sheet for whichever row best matched known header text and
// imported from there — which is exactly how data from those other sheets
// could end up misread as active-roster data. Locking onto 在职 by name, and
// onto fixed column letters within it (per an explicit ask from the person
// who receives this file every month — the two-row merged header above them
// is consistent release to release, but fragile to parse by text), removes
// that failure mode entirely rather than making the heuristic smarter.
// ─────────────────────────────────────────────────────────────────────────

const REQUIRED_SHEET_NAME = "在职";

// B 工号 / D 中文名 / E 越文名 / F 性别 / H 一级部门 / I 区域 / K 二级部门 / L 班组 / M 班次 / N 职位.
// Everything outside these columns (学历, 出生日期, 身份证号码, 成本中心名称, and every column
// past N) is deliberately never read — not because those fields don't exist in the workbook,
// but because this platform was told not to take them from this file.
const FIXED_COLUMNS = {
  employeeCode: 2,
  fullNameZh: 4,
  fullName: 5,
  gender: 6,
  orgUnitLevel1: 8,
  region: 9,
  orgUnitLevel2: 11,
  team: 12,
  shift: 13,
  position: 14,
} as const;

type FixedField = keyof typeof FIXED_COLUMNS;

const GENDER_ALIASES: Record<string, "male" | "female"> = {
  "男": "male",
  "女": "female",
  "nam": "male",
  "nữ": "female",
  "male": "male",
  "female": "female",
  "m": "male",
  "f": "female",
};

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (typeof value === "object") {
    if ("richText" in value) {
      return (value as { richText: { text: string }[] }).richText.map((t) => t.text).join("").trim();
    }
    if ("result" in value) {
      return cellText((value as { result: ExcelJS.CellValue }).result ?? "");
    }
    // Hyperlink cells ({ text, hyperlink }) — recurse into `text` rather than stringifying the
    // whole object (which previously produced the literal text "[object Object]").
    if ("text" in value) {
      return cellText((value as { text: ExcelJS.CellValue }).text);
    }
    if ("error" in value) return "";
  }
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : value.toISOString();
  return String(value).trim();
}

// The two-row merged header above the data (a grouped title row, then the real per-column
// labels) isn't the same fixed row number every month — but column B (工号) always holds a
// plain numeric employee code on the first real data row and never does on a header/title
// row, so that's what marks where the roster actually starts.
function findFirstDataRow(worksheet: ExcelJS.Worksheet): number | null {
  const maxScan = Math.min(15, worksheet.rowCount);
  for (let rowNumber = 1; rowNumber <= maxScan; rowNumber++) {
    const value = cellText(worksheet.getRow(rowNumber).getCell(FIXED_COLUMNS.employeeCode).value);
    if (/^\d{3,}$/.test(value)) return rowNumber;
  }
  return null;
}

function diffableFields(a: Omit<ParsedEmployeeFields, "employeeCode">, b: ParsedEmployeeFields): FieldDiff[] {
  // Only fields this importer actually reads are diffable — comparing a field it no longer
  // reads (education, birthDate, nationalId, costCenterName) against an existing employee's
  // real value would always show as "changed to —", a false diff for data this import was
  // never told to touch in the first place.
  const compareFields: Exclude<FixedField, "employeeCode">[] = [
    "fullName",
    "fullNameZh",
    "gender",
    "orgUnitLevel1",
    "region",
    "orgUnitLevel2",
    "team",
    "shift",
    "position",
  ];
  const diffs: FieldDiff[] = [];
  for (const field of compareFields) {
    const oldValue = a[field] ?? "";
    const newValue = b[field] ?? "";
    if (oldValue !== newValue) {
      diffs.push({ field, oldValue: String(oldValue), newValue: String(newValue) });
    }
  }
  return diffs;
}

function toParsedFields(employee: {
  fullName: string;
  fullNameZh: string | null;
  gender: string | null;
  education: string | null;
  birthDate: Date | null;
  nationalId: string | null;
  orgUnitLevel1: string | null;
  region: string | null;
  costCenterName: string | null;
  orgUnitLevel2: string | null;
  team: string | null;
  shift: string | null;
  position: string | null;
}): Omit<ParsedEmployeeFields, "employeeCode"> {
  return {
    fullName: employee.fullName,
    fullNameZh: employee.fullNameZh,
    gender: employee.gender === "male" || employee.gender === "female" ? employee.gender : null,
    education: employee.education,
    birthDate: employee.birthDate ? employee.birthDate.toISOString().slice(0, 10) : null,
    nationalId: employee.nationalId,
    orgUnitLevel1: employee.orgUnitLevel1 ?? "",
    region: employee.region,
    costCenterName: employee.costCenterName,
    orgUnitLevel2: employee.orgUnitLevel2,
    team: employee.team,
    shift: employee.shift,
    position: employee.position,
  };
}

/** Thrown when the workbook doesn't have the shape this importer requires — a dedicated type
 *  so the action wrapper can show a specific, correct message instead of the generic
 *  "missing column" one, which doesn't fit "wrong sheet" or "can't find where data starts". */
export class EmployeeImportStructureError extends Error {
  constructor(public reason: "sheet_not_found" | "no_data_rows") {
    super(reason);
  }
}

export async function previewEmployeeImport(params: { organizationId: string; buffer: Buffer }): Promise<EmployeeImportPreview> {
  const { organizationId, buffer } = params;

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

  const worksheet = workbook.getWorksheet(REQUIRED_SHEET_NAME);
  if (!worksheet) throw new EmployeeImportStructureError("sheet_not_found");

  const firstDataRow = findFirstDataRow(worksheet);
  if (firstDataRow == null) throw new EmployeeImportStructureError("no_data_rows");

  const get = (row: ExcelJS.Row, field: FixedField) => row.getCell(FIXED_COLUMNS[field]).value;

  const rows: ClassifiedEmployeeRow[] = [];
  const codesSeenInFile = new Set<string>();
  let totalDataRows = 0;

  for (let rowNumber = firstDataRow; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    const employeeCode = cellText(get(row, "employeeCode"));
    if (!employeeCode) continue; // blank/trailing row — not real data, don't count or error on it

    totalDataRows += 1;

    const errors: DictionaryKey[] = [];
    const fullName = cellText(get(row, "fullName"));
    const orgUnitLevel1 = cellText(get(row, "orgUnitLevel1"));
    const genderRaw = cellText(get(row, "gender"));

    if (!fullName) errors.push("employees.import.errorMissingName");
    if (!orgUnitLevel1) errors.push("employees.import.errorMissingDepartment");
    let gender: "male" | "female" | null = null;
    if (genderRaw) {
      gender = GENDER_ALIASES[genderRaw.toLowerCase()] ?? null;
      if (!gender) errors.push("employees.import.errorInvalidGender");
    }

    if (codesSeenInFile.has(employeeCode)) {
      errors.push("employees.import.errorDuplicateCodeInFile");
    }
    codesSeenInFile.add(employeeCode);

    if (errors.length > 0) {
      rows.push({ row: rowNumber, status: "error", employeeCode, employeeId: null, data: null, diffs: [], errors });
      continue;
    }

    const data: ParsedEmployeeFields = {
      employeeCode,
      fullName,
      fullNameZh: cellText(get(row, "fullNameZh")) || null,
      gender,
      education: null,
      birthDate: null,
      nationalId: null,
      orgUnitLevel1,
      region: cellText(get(row, "region")) || null,
      costCenterName: null,
      orgUnitLevel2: cellText(get(row, "orgUnitLevel2")) || null,
      team: cellText(get(row, "team")) || null,
      shift: cellText(get(row, "shift")) || null,
      position: cellText(get(row, "position")) || null,
    };

    rows.push({ row: rowNumber, status: "new", employeeCode, employeeId: null, data, diffs: [], errors: [] });
  }

  // ── Classify against existing DB records (new / existing / updated). ──
  const existingEmployees = await prisma.employee.findMany({ where: { organizationId } });
  const existingByCode = new Map(existingEmployees.map((e) => [e.employeeCode, e]));

  for (const classified of rows) {
    if (classified.status === "error" || !classified.data) continue;

    const existing = existingByCode.get(classified.employeeCode);
    if (!existing) continue; // stays "new"

    classified.employeeId = existing.id;
    const diffs = diffableFields(toParsedFields(existing), classified.data);
    // Being in this file at all means "currently active" — someone previously marked resigned
    // (e.g. by last month's departed-employee sweep) who's back in this month's 在职 sheet must
    // be reactivated even when every tracked field is otherwise unchanged, or a diff-only check
    // would file them under "existing" and commit would never touch (or un-resign) them.
    if (diffs.length > 0 || existing.status !== "active") {
      classified.status = "updated";
      classified.diffs = diffs;
    } else {
      classified.status = "existing";
    }
  }

  // ── Employees active in DB but absent from this file → proposed as departed. ──
  const codesInFile = codesSeenInFile;
  const departedEmployees: DepartedEmployee[] = existingEmployees
    .filter((e) => e.status === "active" && !codesInFile.has(e.employeeCode))
    .map((e) => ({ employeeId: e.id, employeeCode: e.employeeCode, fullName: e.fullName }));

  const summary = {
    newCount: rows.filter((r) => r.status === "new").length,
    existingCount: rows.filter((r) => r.status === "existing").length,
    updatedCount: rows.filter((r) => r.status === "updated").length,
    errorCount: rows.filter((r) => r.status === "error").length,
    departedCount: departedEmployees.length,
  };

  return { ok: true, totalDataRows, summary, rows, departedEmployees };
}

export async function commitEmployeeImport(params: {
  organizationId: string;
  userId: string;
  rows: ClassifiedEmployeeRow[];
  departedEmployeeCodes: string[];
}): Promise<EmployeeImportCommitResult> {
  const { organizationId, userId, rows, departedEmployeeCodes } = params;

  const writable = rows.filter((r) => (r.status === "new" || r.status === "updated") && r.data);
  const skippedErrors = rows.filter((r) => r.status === "error").length;

  // ── Auto-link/create OrgUnit per orgUnitLevel1, same lazy-DEPT-type pattern as incident-import.ts,
  //    so employee.orgUnit?.name keeps feeding the incident-creation snapshot logic. ──
  const existingOrgUnits = await prisma.orgUnit.findMany({ where: { organizationId } });
  const orgUnitIdByName = new Map(existingOrgUnits.map((u) => [u.name.trim(), u.id]));
  let departmentUnitType = await prisma.orgUnitType.findFirst({ where: { organizationId, code: "DEPT" } });

  async function resolveOrgUnitId(name: string): Promise<string> {
    const trimmed = name.trim();
    const existingId = orgUnitIdByName.get(trimmed);
    if (existingId) return existingId;
    if (!departmentUnitType) {
      departmentUnitType = await prisma.orgUnitType.create({
        data: { organizationId, code: "DEPT", name: "Department", level: 0 },
      });
    }
    const code = `DEPT-${trimmed}`.slice(0, 60);
    const created = await prisma.orgUnit.create({
      data: { organizationId, unitTypeId: departmentUnitType.id, code, name: trimmed },
    });
    orgUnitIdByName.set(trimmed, created.id);
    return created.id;
  }

  // Batched once up front instead of one findUnique per row inside the loop below — an import
  // of hundreds of employees would otherwise issue hundreds of sequential round trips just to
  // re-check state the preview already computed.
  const currentByCode = new Map(
    (
      await prisma.employee.findMany({
        where: { organizationId, employeeCode: { in: writable.map((r) => r.data!.employeeCode) } },
      })
    ).map((e) => [e.employeeCode, e])
  );

  // Every distinct department resolved once up front (a full-roster import of thousands of rows
  // realistically touches a few dozen distinct department names) — keeps the row loops below
  // free of any awaited DB round trip, which is what actually made batching them worthwhile.
  const distinctOrgUnitLevel1 = [...new Set(writable.map((r) => r.data!.orgUnitLevel1))];
  const orgUnitIdByRowValue = new Map<string, string>();
  for (const name of distinctOrgUnitLevel1) {
    orgUnitIdByRowValue.set(name, await resolveOrgUnitId(name));
  }

  // Deliberately omits education/birthDate/nationalId/costCenterName — this importer no longer
  // reads those columns (see FIXED_COLUMNS), and including them here at all would overwrite
  // whatever was already on record for every touched employee with null. Leaving the keys out
  // of a Prisma update payload leaves the existing column value alone; for a brand-new employee
  // there's nothing to preserve, so they simply start out unset until entered another way.
  function toFields(data: ParsedEmployeeFields) {
    return {
      fullName: data.fullName,
      fullNameZh: data.fullNameZh,
      gender: data.gender,
      orgUnitLevel1: data.orgUnitLevel1,
      region: data.region,
      orgUnitLevel2: data.orgUnitLevel2,
      team: data.team,
      shift: data.shift,
      position: data.position,
      orgUnitId: orgUnitIdByRowValue.get(data.orgUnitLevel1)!,
      status: "active" as const,
      sourceRowData: data,
    };
  }

  // Defends against the preview being stale by the time the user confirms (another import/edit
  // could have run in between) using the batch fetched above — same split the original per-row
  // "if (!current) create else update" logic made, just grouped ahead of time so each branch can
  // run as one bulk operation instead of one round trip per employee. A full-roster update
  // (thousands of rows) previously meant thousands of individually auto-committed statements —
  // each one its own disk fsync on SQLite — which is what made this take several minutes and
  // occasionally made the underlying connection give out entirely partway through.
  const toCreate = writable.filter((r) => !currentByCode.has(r.data!.employeeCode));
  const toUpdate = writable.filter((r) => currentByCode.has(r.data!.employeeCode));

  // Chunk size for the update transactions below — bounds how much work (and how long) any
  // single transaction holds the SQLite write lock for, rather than one transaction spanning
  // every row in a multi-thousand-row import.
  const CHUNK_SIZE = 500;
  function chunk<T>(items: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
    return chunks;
  }

  let created = 0;
  let updated = 0;

  if (toCreate.length > 0) {
    await prisma.employee.createMany({
      data: toCreate.map((r) => ({ organizationId, employeeCode: r.data!.employeeCode, ...toFields(r.data!) })),
    });
    const createdEmployees = await prisma.employee.findMany({
      where: { organizationId, employeeCode: { in: toCreate.map((r) => r.data!.employeeCode) } },
      select: { id: true },
    });
    await prisma.auditLog.createMany({
      data: createdEmployees.map((e) => ({
        organizationId,
        userId,
        module: "employee",
        recordType: "Employee",
        recordId: e.id,
        action: "create" as const,
      })),
    });
    created = toCreate.length;
  }

  for (const rowsChunk of chunk(toUpdate, CHUNK_SIZE)) {
    await prisma.$transaction(
      [
        ...rowsChunk.map((r) => prisma.employee.update({ where: { id: currentByCode.get(r.data!.employeeCode)!.id }, data: toFields(r.data!) })),
        prisma.auditLog.createMany({
          data: rowsChunk.map((r) => ({
            organizationId,
            userId,
            module: "employee",
            recordType: "Employee",
            recordId: currentByCode.get(r.data!.employeeCode)!.id,
            action: "update" as const,
            fieldName: "source",
            oldValue: null,
            newValue: "excel_import",
          })),
        }),
      ],
      { timeout: 30_000 }
    );
  }
  updated = toUpdate.length;

  let departed = 0;
  if (departedEmployeeCodes.length > 0) {
    const toDepart = await prisma.employee.findMany({
      where: { organizationId, employeeCode: { in: departedEmployeeCodes }, status: "active" },
      select: { id: true },
    });
    if (toDepart.length > 0) {
      await prisma.employee.updateMany({
        where: { id: { in: toDepart.map((e) => e.id) } },
        data: { status: "resigned" },
      });
      await prisma.auditLog.createMany({
        data: toDepart.map((e) => ({
          organizationId,
          userId,
          module: "employee",
          recordType: "Employee",
          recordId: e.id,
          action: "update" as const,
          fieldName: "status",
          oldValue: "active",
          newValue: "resigned",
        })),
      });
      departed = toDepart.length;
    }
  }

  return { created, updated, departed, skippedErrors };
}

export { FIELD_LABEL_KEYS };
