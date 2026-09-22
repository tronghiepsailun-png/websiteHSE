// One-off: renames the "CCG" organization to "CG" everywhere it's displayed (top-left
// badge, footer) — this is purely the Organization.name field, not code/logic. Run once:
// `npx tsx scripts/rename-org-ccg-to-cg.ts`.

import { prisma } from "@/lib/prisma";

async function main() {
  const result = await prisma.organization.updateMany({
    where: { name: "CCG" },
    data: { name: "CG" },
  });
  console.log(`Renamed ${result.count} organization(s) from "CCG" to "CG".`);
}

main()
  .then(() => console.log("Done."))
  .finally(() => process.exit(0));
