import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/server/audit";
import type { DictionaryKey } from "@/lib/i18n/translate";
import {
  type ClassifiedEmployeeRow,
  type DepartedEmployee,
  type EmployeeImportCommitResult,
  type EmployeeImportPreview,
  type FieldDiff,
  type FieldKey,
  type ParsedEmployeeFields,
  FIELD_LABEL_KEYS,
  REQUIRED_FIELDS,
} from "@/server/employee-import-shared";

// ─────────────────────────────────────────────────────────────────────────
// Column header aliases — mixes the source spreadsheet's Chinese headers with
// the Vietnamese labels the user's spec calls each field by, same convention
// as incident-import.ts's HEADER_ALIASES. 序号 (row number) and VALUE (a
// formula column duplicating 工号) are intentionally not mapped to any field —
// they carry no information beyond what employeeCode already stores.
// ─────────────────────────────────────────────────────────────────────────

const HEADER_ALIASES: Record<FieldKey, string[]> = {
  employeeCode: ["工号", "mã nhân viên", "mã nv"],
  fullName: ["越文名", "họ tên tiếng việt", "tên tiếng việt"],
  fullNameZh: ["中文名", "tên tiếng trung"],
  gender: ["性别", "giới tính"],
  education: ["学历", "trình độ"],
  birthDate: ["出生日期", "ngày sinh"],
  nationalId: ["身份证号码", "cccd", "số cccd"],
  orgUnitLevel1: ["一级部门", "bộ phận cấp 1"],
  region: ["区域", "khu vực"],
  costCenterName: ["成本中心名称", "tên trung tâm chi phí"],
  orgUnitLevel2: ["二级部门", "bộ phận cấp 2"],
  team: ["班组", "tổ nhóm"],
  shift: ["班次", "ca làm việc", "ca"],
  position: ["职位", "chức vụ"],
};

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

function normalizeHeader(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (typeof value === "object" && "richText" in value) {
    return (value as { richText: { text: string }[] }).richText.map((t) => t.text).join("");
  }
  if (typeof value === "object" && "result" in value) {
    return String((value as { result: unknown }).result ?? "");
  }
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : value.toISOString();
  return String(value).trim();
}

function isPlausibleBirthDate(d: Date): boolean {
  const year = d.getUTCFullYear();
  return year >= 1900 && year <= 2100;
}

function cellDateIso(value: ExcelJS.CellValue): { iso: string | null; invalid: boolean } {
  if (value == null || value === "") return { iso: null, invalid: false };

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime()) || !isPlausibleBirthDate(value)) return { iso: null, invalid: true };
    return { iso: value.toISOString().slice(0, 10), invalid: false };
  }

  // A cell that holds a raw Excel serial date number (not recognized/formatted as a
  // date by the source spreadsheet) must be converted via Excel's epoch — treating it
  // as a date-ish string instead (e.g. new Date("33574")) silently produces nonsense
  // dates like the year 29513.
  if (typeof value === "number") {
    const parsed = new Date(Math.round((value - 25569) * 86400 * 1000));
    if (Number.isNaN(parsed.getTime()) || !isPlausibleBirthDate(parsed)) return { iso: null, invalid: true };
    return { iso: parsed.toISOString().slice(0, 10), invalid: false };
  }

  const text = cellText(value);
  if (!text) return { iso: null, invalid: false };
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime()) || !isPlausibleBirthDate(parsed)) return { iso: null, invalid: true };
  return { iso: parsed.toISOString().slice(0, 10), invalid: false };
}

/** Scans the first 10 rows of every sheet for the row that best matches our known headers —
 *  same technique as incident-import.ts's locateHeaderRow, generalized here for reuse. */
function locateHeaderRow(workbook: ExcelJS.Workbook) {
  let best: { worksheet: ExcelJS.Worksheet; rowNumber: number; columnsByField: Partial<Record<FieldKey, number>>; score: number } | null = null;

  for (const worksheet of workbook.worksheets) {
    const maxScanRow = Math.min(10, worksheet.rowCount);
    for (let rowNumber = 1; rowNumber <= maxScanRow; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      const columnsByField: Partial<Record<FieldKey, number>> = {};
      let score = 0;

      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const normalized = normalizeHeader(cellText(cell.value));
        if (!normalized) return;
        for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [FieldKey, string[]][]) {
          if (columnsByField[field]) continue; // first match wins
          if (aliases.some((alias) => normalized === alias)) {
            columnsByField[field] = colNumber;
            score += 1;
          }
        }
      });

      if (!best || score > best.score) {
        best = { worksheet, rowNumber, columnsByField, score };
      }
    }
  }

  return best;
}

function diffableFields(a: Omit<ParsedEmployeeFields, "employeeCode">, b: ParsedEmployeeFields): FieldDiff[] {
  const compareFields: Exclude<FieldKey, "employeeCode">[] = [
    "fullName",
    "fullNameZh",
    "gender",
    "education",
    "birthDate",
    "nationalId",
    "orgUnitLevel1",
    "region",
    "costCenterName",
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

export async function previewEmployeeImport(params: { organizationId: string; buffer: Buffer }): Promise<EmployeeImportPreview> {
  const { organizationId, buffer } = params;

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

  const located = locateHeaderRow(workbook);
  const missingRequired = REQUIRED_FIELDS.filter((f) => !located?.columnsByField[f]);
  if (!located || missingRequired.length > 0) {
    return { ok: false, headerErrors: missingRequired.map((column) => ({ column })) };
  }

  const { worksheet, rowNumber: headerRowNumber, columnsByField } = located;

  const get = (row: ExcelJS.Row, field: FieldKey) => {
    const col = columnsByField[field];
    return col ? row.getCell(col).value : null;
  };

  const rows: ClassifiedEmployeeRow[] = [];
  const codesSeenInFile = new Set<string>();
  const nationalIdsSeenInFile = new Map<string, string>(); // nationalId -> first employeeCode that used it
  let totalDataRows = 0;

  for (let rowNumber = headerRowNumber + 1; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    const employeeCode = cellText(get(row, "employeeCode"));
    if (!employeeCode) continue; // blank/trailing row — not real data, don't count or error on it

    totalDataRows += 1;

    const errors: DictionaryKey[] = [];
    const fullName = cellText(get(row, "fullName"));
    const orgUnitLevel1 = cellText(get(row, "orgUnitLevel1"));
    const genderRaw = cellText(get(row, "gender"));
    const { iso: birthDate, invalid: birthDateInvalid } = cellDateIso(get(row, "birthDate"));
    const nationalId = cellText(get(row, "nationalId")) || null;

    if (!fullName) errors.push("employees.import.errorMissingName");
    if (!orgUnitLevel1) errors.push("employees.import.errorMissingDepartment");
    if (birthDateInvalid) errors.push("employees.import.errorInvalidBirthDate");
    let gender: "male" | "female" | null = null;
    if (genderRaw) {
      gender = GENDER_ALIASES[genderRaw.toLowerCase()] ?? null;
      if (!gender) errors.push("employees.import.errorInvalidGender");
    }

    if (codesSeenInFile.has(employeeCode)) {
      errors.push("employees.import.errorDuplicateCodeInFile");
    }
    codesSeenInFile.add(employeeCode);

    if (nationalId) {
      const firstCode = nationalIdsSeenInFile.get(nationalId);
      if (firstCode && firstCode !== employeeCode) {
        errors.push("employees.import.errorDuplicateNationalIdInFile");
      } else {
        nationalIdsSeenInFile.set(nationalId, employeeCode);
      }
    }

    if (errors.length > 0) {
      rows.push({ row: rowNumber, status: "error", employeeCode, employeeId: null, data: null, diffs: [], errors });
      continue;
    }

    const data: ParsedEmployeeFields = {
      employeeCode,
      fullName,
      fullNameZh: cellText(get(row, "fullNameZh")) || null,
      gender,
      education: cellText(get(row, "education")) || null,
      birthDate,
      nationalId,
      orgUnitLevel1,
      region: cellText(get(row, "region")) || null,
      costCenterName: cellText(get(row, "costCenterName")) || null,
      orgUnitLevel2: cellText(get(row, "orgUnitLevel2")) || null,
      team: cellText(get(row, "team")) || null,
      shift: cellText(get(row, "shift")) || null,
      position: cellText(get(row, "position")) || null,
    };

    rows.push({ row: rowNumber, status: "new", employeeCode, employeeId: null, data, diffs: [], errors: [] });
  }

  // ── Classify against existing DB records (new / existing / updated), and flag
  //    nationalId collisions against a *different* existing employee as errors. ──
  const existingEmployees = await prisma.employee.findMany({ where: { organizationId } });
  const existingByCode = new Map(existingEmployees.map((e) => [e.employeeCode, e]));
  const existingByNationalId = new Map(existingEmployees.filter((e) => e.nationalId).map((e) => [e.nationalId!, e]));

  for (const classified of rows) {
    if (classified.status === "error" || !classified.data) continue;

    if (classified.data.nationalId) {
      const owner = existingByNationalId.get(classified.data.nationalId);
      if (owner && owner.employeeCode !== classified.employeeCode) {
        classified.status = "error";
        classified.errors = ["employees.import.errorDuplicateNationalId"];
        classified.data = null;
        continue;
      }
    }

    const existing = existingByCode.get(classified.employeeCode);
    if (!existing) continue; // stays "new"

    classified.employeeId = existing.id;
    const diffs = diffableFields(toParsedFields(existing), classified.data);
    if (diffs.length > 0) {
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

  let created = 0;
  let updated = 0;

  for (const classified of writable) {
    const data = classified.data!;
    const orgUnitId = await resolveOrgUnitId(data.orgUnitLevel1);

    const fields = {
      fullName: data.fullName,
      fullNameZh: data.fullNameZh,
      gender: data.gender,
      education: data.education,
      birthDate: data.birthDate ? new Date(data.birthDate) : null,
      nationalId: data.nationalId,
      orgUnitLevel1: data.orgUnitLevel1,
      region: data.region,
      costCenterName: data.costCenterName,
      orgUnitLevel2: data.orgUnitLevel2,
      team: data.team,
      shift: data.shift,
      position: data.position,
      orgUnitId,
      status: "active",
      sourceRowData: data,
    };

    // Defends against the preview being stale by the time the user confirms (another
    // import/edit could have run in between) using the batch fetched above.
    const current = currentByCode.get(data.employeeCode);

    if (!current) {
      const employee = await prisma.employee.create({ data: { organizationId, employeeCode: data.employeeCode, ...fields } });
      await writeAuditLog({ organizationId, userId, module: "employee", recordType: "Employee", recordId: employee.id, action: "create" });
      created += 1;
    } else {
      await prisma.employee.update({ where: { id: current.id }, data: fields });
      await writeAuditLog({
        organizationId,
        userId,
        module: "employee",
        recordType: "Employee",
        recordId: current.id,
        action: "update",
        changes: [{ field: "source", oldValue: null, newValue: "excel_import" }],
      });
      updated += 1;
    }
  }

  let departed = 0;
  if (departedEmployeeCodes.length > 0) {
    const toDepart = await prisma.employee.findMany({
      where: { organizationId, employeeCode: { in: departedEmployeeCodes }, status: "active" },
    });
    for (const employee of toDepart) {
      await prisma.employee.update({ where: { id: employee.id }, data: { status: "resigned" } });
      await writeAuditLog({
        organizationId,
        userId,
        module: "employee",
        recordType: "Employee",
        recordId: employee.id,
        action: "update",
        changes: [{ field: "status", oldValue: "active", newValue: "resigned" }],
      });
      departed += 1;
    }
  }

  return { created, updated, departed, skippedErrors };
}

export { FIELD_LABEL_KEYS };
