/**
 * One-time data import: takes the real PCCC legal-document folder the user dropped into
 * "Hồ sơ pháp lý PCCC/" (3 zones × 4 groups, exported as separate Google-Drive zip folders)
 * and files each real document against the existing 26×3 RecordEntry catalog (seeded earlier
 * from the Excel checklist, mostly still drive_link-only or missing entirely).
 *
 * For each matched file: copies it into local storage via storageService, extracts a real
 * effective date from .docx content when the "..., ngày D tháng M năm YYYY" dateline is found
 * (never guessed — PDFs here are scanned/no text layer, so those stay dateConfidence=unknown),
 * and calls createRecordVersion so history/superseding works exactly like a manual upload.
 *
 * Safe to re-run: re-running just adds another superseding version on top, so run once.
 * Run: npx tsx scripts/import-pccc-legal-docs.ts
 */
import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { prisma } from "../src/lib/prisma";
import { storageService } from "../src/server/storage";
import { createRecordVersion } from "../src/server/records";

const ORG_NAME = "CCG";
const ROOT_DIR = path.join(process.cwd(), "Hồ sơ pháp lý PCCC");
// The one non-record file sitting loose in the Khu B folder — a meta report about the
// folder's own restructuring, not an actual PCCC compliance document.
const EXCLUDE_FILENAMES = new Set(["BAO_CAO_TAI_CAU_TRUC_HO_SO_PCCC_20260811.md.docx"]);

const ZONE_PREFIX_TO_CODE: Record<string, string> = { "01.": "KHU_A", "02.": "KHU_B", "03.": "KHU_C" };
const GROUP_PREFIX_TO_CODE: Record<string, string> = { "01.": "A", "02.": "B", "03.": "C", "04.": "D" };

const MIME_BY_EXT: Record<string, string> = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

type ClassifyRule = { test: RegExp; code: string; loose?: boolean };

const RULES_BY_GROUP: Record<string, ClassifyRule[]> = {
  A: [
    { test: /PC01|Phiếu thông tin/i, code: "A1" },
    { test: /Quyết định ban hành nội quy/i, code: "A3" },
    { test: /Quyết định phân công người kiểm tra/i, code: "A5" },
    { test: /Quyết định thành lập/i, code: "A6" },
    { test: /Danh sách đội/i, code: "A4" },
    { test: /Nội quy PCCC/i, code: "A2" },
  ],
  B: [
    { test: /Giấy chứng nhận thẩm duyệt/i, code: "B1" },
    { test: /Văn bản nghiệm thu|Văn bản chấp thuận|Biên bản kiểm tra nghiệm thu/i, code: "B2", loose: true },
    { test: /PC06|Phương án chữa cháy/i, code: "B4" },
    { test: /Bản vẽ mặt bằng/i, code: "B5" },
    { test: /Sơ đồ thoát hiểm/i, code: "B6" },
  ],
  C: [
    { test: /Bảng thống kê khí tài/i, code: "C1" },
    { test: /Sổ theo dõi phương tiện/i, code: "C2" },
    { test: /PC02|tự kiểm tra/i, code: "C3" },
    { test: /PC04|Báo cáo kết quả công tác/i, code: "C4", loose: true },
    { test: /PC03|của Công an/i, code: "C5" },
    { test: /Kế hoạch thực tập/i, code: "C6" },
    { test: /Báo cáo kết quả thực tập/i, code: "C7" },
    { test: /họp rút kinh nghiệm/i, code: "C8" },
    { test: /Ghi chép diễn tập/i, code: "C9" },
    { test: /Tài liệu tập huấn|Đơn đề nghị huấn luyện/i, code: "C10" },
    { test: /Biên bản kiểm tra/i, code: "C5", loose: true }, // fallback: generic inspection minutes with no PC03/"của Công an" wording
  ],
  D: [
    { test: /Bảo hiểm cháy nổ/i, code: "D1" },
    { test: /bình chữa cháy/i, code: "D2" },
    { test: /hệ thống/i, code: "D3" },
  ],
};

function classify(groupCode: string, fileName: string): { code: string; loose: boolean } | null {
  const rules = RULES_BY_GROUP[groupCode] ?? [];
  for (const rule of rules) {
    if (rule.test.test(fileName)) return { code: rule.code, loose: !!rule.loose };
  }
  return null;
}

function extractVersionNumber(fileName: string): number | null {
  const m = /-v(\d+)\.[a-z]+$/i.exec(fileName) ?? /(?:lần|bản)\s*(\d+)/i.exec(fileName);
  return m ? Number(m[1]) : null;
}

async function extractDateFromDocx(buffer: Buffer): Promise<{ effectiveDate: Date; quote: string } | null> {
  try {
    const zip = await JSZip.loadAsync(buffer);
    const xmlFile = zip.file("word/document.xml");
    if (!xmlFile) return null;
    const xml = await xmlFile.async("string");
    const text = xml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const m = /ngày\s*(\d{1,2})\s*tháng\s*(\d{1,2})\s*năm\s*(\d{4})/i.exec(text);
    if (!m) return null;
    const day = Number(m[1]);
    const month = Number(m[2]);
    const year = Number(m[3]);
    if (year < 2015 || year > 2027 || month < 1 || month > 12 || day < 1 || day > 31) return null;
    const date = new Date(Date.UTC(year, month - 1, day));
    const start = Math.max(0, m.index - 20);
    const quote = text.slice(start, m.index + m[0].length).trim();
    return { effectiveDate: date, quote };
  } catch {
    return null;
  }
}

type FileHit = { absPath: string; fileName: string; ext: string; versionNumber: number | null };
type VersionGroup = { files: FileHit[]; uncertain: boolean };

async function main() {
  const org = await prisma.organization.findFirstOrThrow({ where: { name: ORG_NAME } });
  const domain = await prisma.recordDomain.findFirstOrThrow({
    where: { organizationId: org.id, code: "PCCC" },
    include: { groups: { include: { types: true } } },
  });
  const typeIdByCode = new Map<string, string>();
  for (const g of domain.groups) for (const t of g.types) typeIdByCode.set(t.code, t.id);

  const zones = await prisma.orgUnit.findMany({ where: { organizationId: org.id, unitType: { code: "SITE" } } });
  const zoneIdByCode = new Map(zones.map((z) => [z.code, z.id]));

  const stats = { versionsCreated: 0, filesImported: 0, unmatched: [] as string[], missing: [] as string[], dated: 0, undated: 0 };

  const zoneOuterDirs = fs.readdirSync(ROOT_DIR).filter((d) => fs.statSync(path.join(ROOT_DIR, d)).isDirectory());

  for (const outer of zoneOuterDirs) {
    const zonePrefix = outer.slice(0, 3);
    const zoneCode = ZONE_PREFIX_TO_CODE[zonePrefix];
    if (!zoneCode) continue;
    const outerPath = path.join(ROOT_DIR, outer);
    const innerDirs = fs.readdirSync(outerPath).filter((d) => fs.statSync(path.join(outerPath, d)).isDirectory());
    if (innerDirs.length !== 1) throw new Error(`Expected exactly 1 zone folder inside ${outer}, found ${innerDirs.length}`);
    const zoneDir = path.join(outerPath, innerDirs[0]);
    const orgUnitId = zoneIdByCode.get(zoneCode);
    if (!orgUnitId) throw new Error(`Zone ${zoneCode} not found in DB`);

    const groupDirs = fs.readdirSync(zoneDir).filter((d) => fs.statSync(path.join(zoneDir, d)).isDirectory());
    // Collect all matched files per typeCode for this zone, across whichever group folder they're in.
    const byType = new Map<string, FileHit[]>();
    const byTypeUncertain = new Map<string, boolean>();

    for (const groupDir of groupDirs) {
      const groupPrefix = groupDir.slice(0, 3);
      const groupCode = GROUP_PREFIX_TO_CODE[groupPrefix];
      if (!groupCode) continue;
      const groupPath = path.join(zoneDir, groupDir);
      const fileNames = fs.readdirSync(groupPath).filter((f) => fs.statSync(path.join(groupPath, f)).isFile());

      for (const fileName of fileNames) {
        if (EXCLUDE_FILENAMES.has(fileName)) continue;
        const hit = classify(groupCode, fileName);
        if (!hit) {
          stats.unmatched.push(`${zoneCode}/${groupDir}/${fileName}`);
          continue;
        }
        const ext = path.extname(fileName).toLowerCase();
        const fileHit: FileHit = { absPath: path.join(groupPath, fileName), fileName, ext, versionNumber: extractVersionNumber(fileName) };
        if (!byType.has(hit.code)) byType.set(hit.code, []);
        byType.get(hit.code)!.push(fileHit);
        if (hit.loose) byTypeUncertain.set(hit.code, true);
      }
    }

    for (const [typeCode, files] of byType) {
      const recordTypeId = typeIdByCode.get(typeCode);
      if (!recordTypeId) {
        console.warn(`Unknown type code ${typeCode}, skipping ${files.length} file(s)`);
        continue;
      }
      const entry = await prisma.recordEntry.findFirst({ where: { recordTypeId, orgUnitId } });
      if (!entry) {
        console.warn(`No RecordEntry for ${zoneCode}/${typeCode}, skipping`);
        continue;
      }

      // Sequential versions only when EVERY file carries a parseable version number
      // (v1/v2, "lần N", "bản N") — otherwise we can't be sure of chronological order,
      // so bundle everything into one version instead of guessing an order.
      const allNumbered = files.every((f) => f.versionNumber !== null);
      const versionGroups: VersionGroup[] = allNumbered
        ? [...files].sort((a, b) => a.versionNumber! - b.versionNumber!).map((f) => ({ files: [f], uncertain: false }))
        : [{ files, uncertain: files.length > 1 }];

      const uncertain = byTypeUncertain.get(typeCode) ?? false;

      for (const group of versionGroups) {
        const recordFiles = [];
        let effectiveDate: Date | null = null;
        let dateSourceQuote: string | null = null;
        for (const f of group.files) {
          const buffer = fs.readFileSync(f.absPath);
          if (!effectiveDate && f.ext === ".docx") {
            const extracted = await extractDateFromDocx(buffer);
            if (extracted) {
              effectiveDate = extracted.effectiveDate;
              dateSourceQuote = extracted.quote;
            }
          }
          const { storagePath } = await storageService.save({
            organizationId: org.id,
            module: "record",
            recordId: entry.id,
            fileName: f.fileName,
            buffer,
          });
          recordFiles.push({
            fileName: f.fileName,
            storageType: "upload" as const,
            storagePath,
            sizeBytes: buffer.length,
            mimeType: MIME_BY_EXT[f.ext] ?? "application/octet-stream",
          });
          stats.filesImported++;
        }

        const notesParts = ["Nhập từ hồ sơ gốc do người dùng cung cấp (thư mục \"Hồ sơ pháp lý PCCC\")."];
        if (group.uncertain) notesParts.push("Gộp nhiều tệp liên quan do chưa rõ thứ tự thời gian — cần người phụ trách xác nhận lại.");
        if (uncertain) notesParts.push("Loại hồ sơ được suy đoán theo tên tệp gần đúng nhất — cần xác nhận lại đúng danh mục.");
        if (!effectiveDate) notesParts.push("Không tìm thấy ngày lập/ký rõ ràng trong nội dung tệp (hoặc tệp là bản scan không có lớp văn bản) — cần đối chiếu bản gốc.");

        await createRecordVersion({
          organizationId: org.id,
          userId: null,
          entryId: entry.id,
          effectiveDate,
          dateSourceQuote,
          dateConfidence: effectiveDate ? "confirmed" : "unknown",
          expiresAtOverride: null,
          verificationStatus: group.uncertain || uncertain ? "needs_verification" : "ok",
          notes: notesParts.join(" "),
          files: recordFiles,
        });
        stats.versionsCreated++;
        if (effectiveDate) stats.dated++;
        else stats.undated++;
      }
    }

    // Report which catalog types still have no file at all for this zone.
    for (const g of domain.groups) {
      for (const t of g.types) {
        if (!byType.has(t.code)) stats.missing.push(`${zoneCode}/${t.code} ${t.name}`);
      }
    }
  }

  console.log("=== IMPORT COMPLETE ===");
  console.log(JSON.stringify({ ...stats, missing: undefined, unmatched: undefined }, null, 2));
  console.log(`\n--- Unmatched files (${stats.unmatched.length}) ---`);
  stats.unmatched.forEach((f) => console.log(f));
  console.log(`\n--- Still missing (no file found) (${stats.missing.length}) ---`);
  stats.missing.forEach((f) => console.log(f));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
