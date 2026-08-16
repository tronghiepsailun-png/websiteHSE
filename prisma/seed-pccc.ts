/**
 * One-time data migration: populates the PCCC records catalog + the real 26x3 zone
 * entries/versions/files for the CCG organization from the company's existing
 * Google-Sheets-based checklist. Run once via `npx tsx prisma/seed-pccc.ts`.
 * Safe to re-run: every step is idempotent (skips anything that already exists).
 */
import ExcelJS from "exceljs";
import { addMonths } from "date-fns";
import { prisma } from "../src/lib/prisma";
import { writeAuditLog } from "../src/server/audit";

const XLSX_PATH = "D:/New folder/Checklist_PCCC_3_Khu_ABC_20260812_v3.xlsx";
const CCG_ORG_CODE = "CCG";
const UNKNOWN_DATE_MARKER = "Chưa xác định – cần kiểm tra tài liệu gốc";

const GROUP_DEFS = [
  { code: "A", name: "Hồ sơ pháp lý gốc", sheet: "A - Hồ sơ pháp lý gốc", sortOrder: 1 },
  { code: "B", name: "Hồ sơ kỹ thuật công trình", sheet: "B - Hồ sơ kỹ thuật công trình", sortOrder: 2 },
  { code: "C", name: "Vận hành - theo dõi định kỳ", sheet: "C - Vận hành - theo dõi định kỳ", sortOrder: 3 },
  { code: "D", name: "Hồ sơ bảo hiểm – kiểm định", sheet: "D - Hồ sơ bảo hiểm – kiểm định", sortOrder: 4 },
];

const ZONES = [
  { code: "KHU_A", name: "Khu A", offset: 8 },
  { code: "KHU_B", name: "Khu B", offset: 16 },
  { code: "KHU_C", name: "Khu C", offset: 24 },
];

function cellText(cell: ExcelJS.Cell | undefined): string {
  if (!cell) return "";
  const v = cell.value;
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    const obj = v as { richText?: { text: string }[]; formula?: string; result?: unknown; text?: unknown };
    if (obj.richText) return obj.richText.map((r) => r.text).join("");
    if (obj.formula) {
      if (obj.result instanceof Date) return obj.result.toISOString().slice(0, 10);
      return obj.result != null ? String(obj.result) : "";
    }
    if (obj.text !== undefined) return String(obj.text);
  }
  return String(v);
}

function cellLink(cell: ExcelJS.Cell | undefined): { fileName: string; url: string } | null {
  if (!cell) return null;
  const v = cell.value as { hyperlink?: string; text?: unknown; formula?: string } | null;
  if (v == null || typeof v !== "object") return null;
  if (v.hyperlink) return { fileName: String(v.text ?? "Xem file"), url: v.hyperlink };
  if (v.formula) {
    const m = /HYPERLINK\("([^"]+)"\s*,\s*"([^"]*)"\)/.exec(v.formula);
    if (m) return { fileName: m[2] || "Xem file", url: m[1] };
  }
  return null;
}

function parseIsoDate(text: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  return new Date(`${text}T00:00:00.000Z`);
}

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(XLSX_PATH);

  const org = await prisma.organization.findFirstOrThrow({ where: { code: CCG_ORG_CODE } });

  let siteType = await prisma.orgUnitType.findFirst({ where: { organizationId: org.id, code: "SITE" } });
  if (!siteType) {
    siteType = await prisma.orgUnitType.create({ data: { organizationId: org.id, code: "SITE", name: "Site", level: 0 } });
  }

  const zoneUnitIds: Record<string, string> = {};
  for (const z of ZONES) {
    let unit = await prisma.orgUnit.findFirst({ where: { organizationId: org.id, code: z.code } });
    if (!unit) {
      unit = await prisma.orgUnit.create({ data: { organizationId: org.id, unitTypeId: siteType.id, code: z.code, name: z.name } });
    }
    zoneUnitIds[z.code] = unit.id;
  }

  let domain = await prisma.recordDomain.findFirst({ where: { organizationId: org.id, code: "PCCC" } });
  if (!domain) {
    domain = await prisma.recordDomain.create({ data: { organizationId: org.id, code: "PCCC", name: "Hồ sơ PCCC" } });
  }

  const stats = { createdTypes: 0, createdEntries: 0, createdVersions: 0, createdFiles: 0, skippedMissing: 0, notApplicable: 0 };

  for (const gdef of GROUP_DEFS) {
    let group = await prisma.recordGroup.findFirst({ where: { domainId: domain.id, code: gdef.code } });
    if (!group) {
      group = await prisma.recordGroup.create({ data: { domainId: domain.id, code: gdef.code, name: gdef.name, sortOrder: gdef.sortOrder } });
    }

    const sheet = wb.getWorksheet(gdef.sheet);
    if (!sheet) throw new Error(`Sheet not found: ${gdef.sheet}`);

    let lastRow = 5;
    for (let r = 6; r <= 80; r++) {
      if (sheet.getRow(r).getCell(1).value == null) break;
      lastRow = r;
    }

    let sortOrder = 0;
    for (let r = 6; r <= lastRow; r++) {
      sortOrder++;
      const row = sheet.getRow(r);
      const code = cellText(row.getCell(2)).trim();
      const name = cellText(row.getCell(3)).trim();
      if (!code || !name) continue;

      const legalBasis = cellText(row.getCell(4)).trim() || null;
      const frequencyLabel = cellText(row.getCell(5)).trim() || null;
      const cycleRaw = cellText(row.getCell(6)).trim();
      const cycleMonths = cycleRaw ? Number(cycleRaw) : null;
      const responsibleUnit = cellText(row.getCell(7)).trim() || null;

      let recordType = await prisma.recordType.findFirst({ where: { groupId: group.id, code } });
      if (!recordType) {
        recordType = await prisma.recordType.create({
          data: { groupId: group.id, code, name, legalBasis, frequencyLabel, cycleMonths, responsibleUnit, sortOrder },
        });
        stats.createdTypes++;
      }

      for (const z of ZONES) {
        const status = cellText(row.getCell(z.offset)).trim();
        const dateText = cellText(row.getCell(z.offset + 1)).trim();
        const notes = cellText(row.getCell(z.offset + 5)).trim() || null;
        const link1 = cellLink(row.getCell(z.offset + 6));
        const link2 = cellLink(row.getCell(z.offset + 7));
        const notApplicable = status === "Không áp dụng";

        let entry = await prisma.recordEntry.findFirst({ where: { recordTypeId: recordType.id, orgUnitId: zoneUnitIds[z.code] } });
        if (!entry) {
          entry = await prisma.recordEntry.create({
            data: { organizationId: org.id, recordTypeId: recordType.id, orgUnitId: zoneUnitIds[z.code], notApplicable },
          });
          stats.createdEntries++;
          if (notApplicable) stats.notApplicable++;
        }
        if (notApplicable) continue;

        const existingVersion = await prisma.recordVersion.findFirst({ where: { entryId: entry.id, isSuperseded: false } });
        if (existingVersion) continue;

        let dateConfidence: "confirmed" | "estimated" | "unknown";
        let effectiveDate: Date | null;
        if (dateText === UNKNOWN_DATE_MARKER) {
          dateConfidence = "unknown";
          effectiveDate = null;
        } else {
          const parsed = parseIsoDate(dateText);
          if (!parsed) {
            stats.skippedMissing++;
            continue;
          }
          effectiveDate = parsed;
          dateConfidence = /ngày ước tính/i.test(notes ?? "") ? "estimated" : "confirmed";
        }

        const files = [link1, link2].filter((l): l is { fileName: string; url: string } => l != null);
        const expiresAt = effectiveDate && cycleMonths ? addMonths(effectiveDate, cycleMonths) : null;

        await prisma.recordVersion.create({
          data: {
            entryId: entry.id,
            effectiveDate,
            dateConfidence,
            expiresAt,
            expiresAtIsManual: false,
            verificationStatus: "ok",
            notes,
            enteredById: null,
            files: { create: files.map((f) => ({ fileName: f.fileName, storageType: "drive_link", url: f.url })) },
          },
        });
        stats.createdVersions++;
        stats.createdFiles += files.length;
      }
    }
  }

  await writeAuditLog({
    organizationId: org.id,
    userId: null,
    module: "records",
    recordType: "RecordDomain",
    recordId: domain.id,
    action: "create",
    changes: [{ field: "seedImport", oldValue: null, newValue: JSON.stringify(stats) }],
  });

  console.log("PCCC seed complete:", stats);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
