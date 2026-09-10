/**
 * One-time follow-up to import-pccc-legal-docs.ts: the records module's day-to-day update
 * path is now the 12-slot grid on each entry's detail page (RecordEntrySlot), not the
 * version-history "Thêm phiên bản mới" flow (retired). This moves every real file the import
 * script attached to a RecordVersion into slots instead, oldest first, so they show up in the
 * UI the user actually uses going forward. Reuses the same storagePath (no file is re-copied)
 * — RecordVersion rows are left untouched as read-only history.
 * Run: npx tsx scripts/migrate-record-files-to-slots.ts
 */
import { prisma } from "../src/lib/prisma";
import { RECORD_ENTRY_SLOT_COUNT } from "../src/lib/records-constants";

const IMPORT_CUTOFF = new Date("2026-08-28T00:00:00.000Z");

async function main() {
  const entries = await prisma.recordEntry.findMany({
    include: {
      versions: {
        where: { enteredAt: { gte: IMPORT_CUTOFF } },
        orderBy: { enteredAt: "asc" },
        include: { files: { where: { storageType: "upload" } } },
      },
    },
  });

  let entriesFilled = 0;
  let slotsFilled = 0;

  for (const entry of entries) {
    const orderedFiles = entry.versions.flatMap((v) =>
      v.files.map((f) => ({ file: f, effectiveDate: v.effectiveDate, expiresAt: v.expiresAt }))
    );
    if (orderedFiles.length === 0) continue;
    if (orderedFiles.length > RECORD_ENTRY_SLOT_COUNT) {
      console.warn(`Entry ${entry.id} has ${orderedFiles.length} files, more than ${RECORD_ENTRY_SLOT_COUNT} slots — truncating.`);
    }

    for (let i = 0; i < Math.min(orderedFiles.length, RECORD_ENTRY_SLOT_COUNT); i++) {
      const { file, effectiveDate, expiresAt } = orderedFiles[i];
      const slotIndex = i + 1;
      await prisma.recordEntrySlot.upsert({
        where: { entryId_slotIndex: { entryId: entry.id, slotIndex } },
        create: {
          entryId: entry.id,
          slotIndex,
          fileName: file.fileName,
          storageType: "upload",
          storagePath: file.storagePath,
          sizeBytes: file.sizeBytes,
          mimeType: file.mimeType,
          startDate: effectiveDate,
          expiresAt,
          uploadedAt: file.uploadedAt,
        },
        update: {
          fileName: file.fileName,
          storageType: "upload",
          storagePath: file.storagePath,
          sizeBytes: file.sizeBytes,
          mimeType: file.mimeType,
          startDate: effectiveDate,
          expiresAt,
          uploadedAt: file.uploadedAt,
        },
      });
      slotsFilled++;
    }
    entriesFilled++;
  }

  console.log(`Filled ${slotsFilled} slot(s) across ${entriesFilled} entries.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
