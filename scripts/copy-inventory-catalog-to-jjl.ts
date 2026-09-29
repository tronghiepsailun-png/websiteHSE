// One-off, idempotent: copies the Tồn kho item catalog (name, Chinese name, unit, photo,
// minimum-stock standard, order) from CCG to the "JL" organization (code JJL02), so JJL starts
// with the same picture cards and only has to enter quantities. Stock itself is never copied —
// it's computed from InventoryTransaction and JJL gets no transactions, so every copied item
// starts at 0. Items JJL already has (same name) are skipped, CCG is only read, never modified.
// Photos are plain public files under public/inventory, so both orgs can safely point at the
// same file (editing a photo later uploads a new file, never overwrites the shared one).
//
// Run on the server after scripts/add-organization-jjl.ts:
//   npx tsx scripts/copy-inventory-catalog-to-jjl.ts            (copy)
//   npx tsx scripts/copy-inventory-catalog-to-jjl.ts --dry-run  (only list what would be copied)

import { prisma } from "@/lib/prisma";

const SOURCE_NAME = "CCG";
const TARGET_CODE = "JJL02";
const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  const source = await prisma.organization.findFirst({ where: { name: SOURCE_NAME } });
  if (!source) throw new Error(`Source organization "${SOURCE_NAME}" not found.`);

  const target = await prisma.organization.findUnique({ where: { code: TARGET_CODE } });
  if (!target && !DRY_RUN) {
    throw new Error(`Organization "${TARGET_CODE}" not found — run scripts/add-organization-jjl.ts first.`);
  }

  const items = await prisma.inventoryItem.findMany({
    where: { organizationId: source.id, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  const existingNames = new Set(
    target
      ? (await prisma.inventoryItem.findMany({ where: { organizationId: target.id }, select: { name: true } })).map((i) => i.name)
      : []
  );

  let copied = 0;
  for (const item of items) {
    if (existingNames.has(item.name)) {
      console.log(`  skip (already exists): ${item.name}`);
      continue;
    }
    console.log(`  ${DRY_RUN ? "would copy" : "copy"}: ${item.name} (${item.unit}, chuẩn ${item.minStockLevel})`);
    if (!DRY_RUN && target) {
      await prisma.inventoryItem.create({
        data: {
          organizationId: target.id,
          name: item.name,
          nameZh: item.nameZh,
          unit: item.unit,
          imageUrl: item.imageUrl,
          minStockLevel: item.minStockLevel,
          sortOrder: item.sortOrder,
        },
      });
    }
    copied++;
  }

  console.log(`${DRY_RUN ? "[dry-run] " : ""}${copied} of ${items.length} items ${DRY_RUN ? "would be" : ""} copied from ${source.name} to ${target?.name ?? TARGET_CODE}.`);
}

main()
  .then(() => console.log("Done."))
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
