/**
 * One-time destructive cleanup: permanently deletes the JINYU and SAILUN tenant
 * organizations (and everything cascading from them — org units, employees, incidents,
 * CAPA, documents, etc.) so the platform becomes a single-company (CCG) deployment.
 * A full DB backup was taken before running this (see ../db-backups/).
 * Run: npx tsx scripts/delete-organizations.ts
 */
import { prisma } from "../src/lib/prisma";

const NAMES_TO_DELETE = ["JINYU", "SAILUN"];

async function main() {
  for (const name of NAMES_TO_DELETE) {
    const org = await prisma.organization.findFirst({ where: { name } });
    if (!org) {
      console.log(`Organization named "${name}" not found — skipping.`);
      continue;
    }
    const result = await prisma.organization.delete({ where: { id: org.id } });
    console.log(`Deleted organization "${result.name}" (${result.code}), id=${result.id}`);
  }

  // Clean up any User rows left with zero remaining organization memberships (and who
  // aren't a platform admin), since they can no longer sign into anything.
  const orphans = await prisma.user.findMany({
    where: { isPlatformAdmin: false, userOrganizations: { none: {} } },
    select: { id: true, email: true },
  });
  for (const u of orphans) {
    await prisma.user.delete({ where: { id: u.id } });
    console.log(`Deleted orphaned user account: ${u.email}`);
  }

  const remaining = await prisma.organization.findMany({ select: { name: true, code: true } });
  console.log("Remaining organizations:", remaining);
}

main().finally(() => prisma.$disconnect());
