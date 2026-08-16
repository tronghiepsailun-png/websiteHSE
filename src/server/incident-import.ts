import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/server/audit";
import type { DictionaryKey } from "@/lib/i18n/translate";
import { type FieldKey, REQUIRED_FIELDS } from "@/server/incident-import-shared";

// ─────────────────────────────────────────────────────────────────────────
// Column header aliases. Matching is case-insensitive/trimmed so both the
// original Chinese header convention (事件编号, ...) and a Vietnamese-labeled
// spreadsheet work against the same importer. Add more aliases here as real
// files with different header wording show up — do not require callers to
// reformat their spreadsheet to match us.
// ─────────────────────────────────────────────────────────────────────────

const HEADER_ALIASES: Record<FieldKey, string[]> = {
  incidentNumber: ["事件编号", "số hiệu sự cố", "số hiệu", "mã sự cố"],
  occurredAt: ["发生日期", "ngày xảy ra"],
  department: ["责任部门", "bộ phận chịu trách nhiệm", "bộ phận trách nhiệm", "bộ phận"],
  severityCode: ["事件级别", "mức độ", "mức độ nghiêm trọng"],
  description: ["事件简述", "mô tả sự cố", "mô tả"],
  correctiveAction: ["整改措施", "hành động khắc phục"],
  responsiblePersonName: ["区域责任人", "người phụ trách"],
  injuredPersonName: ["受伤人员", "người bị nạn"],
  locationEquipment: ["地点/设备", "khu vực/thiết bị", "khu vực/địa điểm", "khu vực"],
  costRmb: ["费用统计（元）", "费用统计(元)", "chi phí (rmb)", "chi phí (元)"],
  costVnd: ["费用统计（越盾）", "费用统计(越盾)", "chi phí (vnđ)", "chi phí"],
  pointsDeducted: ["扣分", "điểm trừ"],
  injuredBodyPart: ["受伤部位", "vị trí bị thương", "bộ phận cơ thể bị thương"],
  categoryName: ["事故类型", "loại sự cố"],
  notes: ["备注", "ghi chú"],
};

export type RowError = { row: number; messageKey: DictionaryKey };
export type DuplicateEntry = { row: number; incidentNumber: string };

export type ImportResult =
  | { ok: false; headerErrors: { column: FieldKey }[] }
  | {
      ok: true;
      totalDataRows: number;
      created: number;
      duplicates: DuplicateEntry[];
      errors: RowError[];
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

function cellNumber(value: ExcelJS.CellValue): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") return value;
  if (typeof value === "object" && "result" in value) {
    const r = (value as { result: unknown }).result;
    return typeof r === "number" ? r : null;
  }
  const n = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function cellDate(value: ExcelJS.CellValue): Date | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) return value;
  const text = cellText(value);
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Scans the first 10 rows of every sheet for the row that best matches our known headers. */
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

export async function importIncidentsFromExcel(params: {
  organizationId: string;
  userId: string;
  buffer: Buffer;
}): Promise<ImportResult> {
  const { organizationId, userId, buffer } = params;

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

  type ParsedRow = {
    row: number;
    incidentNumber: string;
    occurredAt: Date;
    department: string | null;
    severityCode: string;
    description: string;
    correctiveAction: string | null;
    responsiblePersonName: string | null;
    injuredPersonName: string | null;
    locationEquipment: string | null;
    costRmb: number | null;
    costVnd: number | null;
    pointsDeducted: number | null;
    injuredBodyPart: string | null;
    categoryName: string;
    notes: string | null;
    rawRow: Record<string, string>;
  };

  const parsedRows: ParsedRow[] = [];
  const errors: RowError[] = [];
  let totalDataRows = 0;

  for (let rowNumber = headerRowNumber + 1; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    const incidentNumber = cellText(get(row, "incidentNumber"));
    if (!incidentNumber) continue; // blank/trailing row — not real data, don't count or error on it

    totalDataRows += 1;

    const occurredAt = cellDate(get(row, "occurredAt"));
    const severityCode = cellText(get(row, "severityCode"));
    const description = cellText(get(row, "description"));
    const categoryName = cellText(get(row, "categoryName"));

    if (!occurredAt) {
      errors.push({ row: rowNumber, messageKey: "incidents.import.errorMissingOccurredAt" });
      continue;
    }
    if (!severityCode) {
      errors.push({ row: rowNumber, messageKey: "incidents.import.errorMissingSeverity" });
      continue;
    }
    if (!categoryName) {
      errors.push({ row: rowNumber, messageKey: "incidents.import.errorMissingCategory" });
      continue;
    }
    if (!description) {
      errors.push({ row: rowNumber, messageKey: "incidents.import.errorMissingDescription" });
      continue;
    }

    const rawRow: Record<string, string> = {};
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const headerCell = worksheet.getRow(headerRowNumber).getCell(colNumber);
      const headerLabel = cellText(headerCell.value) || `col_${colNumber}`;
      rawRow[headerLabel] = cellText(cell.value);
    });

    parsedRows.push({
      row: rowNumber,
      incidentNumber,
      occurredAt,
      department: cellText(get(row, "department")) || null,
      severityCode,
      description,
      correctiveAction: cellText(get(row, "correctiveAction")) || null,
      responsiblePersonName: cellText(get(row, "responsiblePersonName")) || null,
      injuredPersonName: cellText(get(row, "injuredPersonName")) || null,
      locationEquipment: cellText(get(row, "locationEquipment")) || null,
      costRmb: cellNumber(get(row, "costRmb")),
      costVnd: cellNumber(get(row, "costVnd")),
      pointsDeducted: cellNumber(get(row, "pointsDeducted")),
      injuredBodyPart: cellText(get(row, "injuredBodyPart")) || null,
      categoryName,
      notes: cellText(get(row, "notes")) || null,
      rawRow,
    });
  }

  if (parsedRows.length === 0) {
    return { ok: true, totalDataRows, created: 0, duplicates: [], errors };
  }

  // ── Resolve/auto-create reference data (categories, severities, departments) ──
  const existingCategories = await prisma.incidentCategory.findMany({ where: { organizationId } });
  const categoryIdByName = new Map(existingCategories.map((c) => [c.name.trim(), c.id]));
  const maxCategorySortOrder = existingCategories.reduce((max, c) => Math.max(max, c.sortOrder), 0);

  const existingSeverities = await prisma.incidentSeverity.findMany({ where: { organizationId } });
  const severityIdByCode = new Map(existingSeverities.map((s) => [s.code.trim(), s.id]));
  const maxSeverityRank = existingSeverities.reduce((max, s) => Math.max(max, s.rank), 0);

  const existingOrgUnits = await prisma.orgUnit.findMany({ where: { organizationId } });
  const orgUnitIdByName = new Map(existingOrgUnits.map((u) => [u.name.trim(), u.id]));
  let departmentUnitType = await prisma.orgUnitType.findFirst({ where: { organizationId, code: "DEPT" } });

  let nextCategorySortOrder = maxCategorySortOrder;
  let nextSeverityRank = maxSeverityRank;

  for (const parsed of parsedRows) {
    const categoryName = parsed.categoryName.trim();
    if (!categoryIdByName.has(categoryName)) {
      nextCategorySortOrder += 1;
      const created = await prisma.incidentCategory.create({
        data: { organizationId, code: categoryName, name: categoryName, sortOrder: nextCategorySortOrder },
      });
      categoryIdByName.set(categoryName, created.id);
    }

    const severityCode = parsed.severityCode.trim();
    if (!severityIdByCode.has(severityCode)) {
      // Single-letter A–E codes follow the industry convention (A = most severe);
      // anything else is appended above the current highest rank as a safe default.
      const letterRank = /^[A-E]$/i.test(severityCode) ? 5 - (severityCode.toUpperCase().charCodeAt(0) - 65) : null;
      nextSeverityRank = letterRank ?? nextSeverityRank + 1;
      const created = await prisma.incidentSeverity.create({
        data: { organizationId, code: severityCode, name: severityCode, rank: letterRank ?? nextSeverityRank },
      });
      severityIdByCode.set(severityCode, created.id);
    }

    if (parsed.department) {
      const departmentName = parsed.department.trim();
      if (!orgUnitIdByName.has(departmentName)) {
        if (!departmentUnitType) {
          departmentUnitType = await prisma.orgUnitType.create({
            data: { organizationId, code: "DEPT", name: "Department", level: 0 },
          });
        }
        const code = `DEPT-${departmentName}`.slice(0, 60);
        const created = await prisma.orgUnit.create({
          data: { organizationId, unitTypeId: departmentUnitType.id, code, name: departmentName },
        });
        orgUnitIdByName.set(departmentName, created.id);
      }
    }
  }
  // ── De-dup by incidentNumber, then create ──
  const incidentNumbers = parsedRows.map((r) => r.incidentNumber);
  const existingIncidents = await prisma.incident.findMany({
    where: { organizationId, incidentNumber: { in: incidentNumbers } },
    select: { incidentNumber: true },
  });
  const existingNumberSet = new Set(existingIncidents.map((i) => i.incidentNumber));

  const duplicates: DuplicateEntry[] = [];
  let created = 0;

  for (const parsed of parsedRows) {
    if (existingNumberSet.has(parsed.incidentNumber)) {
      duplicates.push({ row: parsed.row, incidentNumber: parsed.incidentNumber });
      continue;
    }

    const incident = await prisma.incident.create({
      data: {
        organizationId,
        incidentNumber: parsed.incidentNumber,
        occurredAt: parsed.occurredAt,
        orgUnitId: parsed.department ? (orgUnitIdByName.get(parsed.department.trim()) ?? null) : null,
        departmentSnapshot: parsed.department,
        locationDetail: parsed.locationEquipment,
        employeeNameSnapshot: parsed.injuredPersonName,
        responsiblePersonNameSnapshot: parsed.responsiblePersonName,
        categoryId: categoryIdByName.get(parsed.categoryName.trim())!,
        severityId: severityIdByCode.get(parsed.severityCode.trim())!,
        description: parsed.description,
        correctiveAction: parsed.correctiveAction,
        costRmb: parsed.costRmb,
        costVnd: parsed.costVnd,
        pointsDeducted: parsed.pointsDeducted,
        injuredBodyPart: parsed.injuredBodyPart,
        notes: parsed.notes,
        sourceRowData: parsed.rawRow,
        status: "closed", // imported historical records are treated as already resolved
        reportedById: userId,
      },
    });

    await writeAuditLog({
      organizationId,
      userId,
      module: "incident",
      recordType: "Incident",
      recordId: incident.id,
      action: "create",
      changes: [{ field: "source", oldValue: null, newValue: "excel_import" }],
    });

    // Track newly created incident numbers too, in case the same file lists a
    // number twice (protects against intra-file duplicates, not just DB ones).
    existingNumberSet.add(parsed.incidentNumber);
    created += 1;
  }

  return { ok: true, totalDataRows, created, duplicates, errors };
}
