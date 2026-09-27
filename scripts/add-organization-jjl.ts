// One-off, idempotent: creates the "JL" organization (code JJL02) so its people can start using
// this platform as a second, fully separate tenant — every module already scopes all data by
// organizationId, so nothing from CCG is visible to JJL or vice versa. Only inserts a new
// Organization row; never touches any existing organization/user/data. Run once:
// `npx tsx scripts/add-organization-jjl.ts`.
//
// This does NOT create any user account or password — a platform admin has to sign in, switch
// the org switcher (top-left) to "JL", then use Admin > Users to invite the first JJL account by
// hand, typing the password directly into the browser (never through a script).

import { prisma } from "@/lib/prisma";

const NAME = "JL";
const CODE = "JJL02";

async function main() {
  const existing = await prisma.organization.findUnique({ where: { code: CODE } });
  if (existing) {
    console.log(`Organization "${CODE}" already exists (${existing.name}, id ${existing.id}) — nothing to do.`);
    return;
  }

  const org = await prisma.organization.create({ data: { name: NAME, code: CODE } });
  console.log(`Created organization "${org.name}" (code ${org.code}, id ${org.id}).`);
  console.log(`Next: sign in as a platform admin, switch the org switcher to "${org.name}", then go to Admin > Users to invite the first JJL account.`);
}

main()
  .then(() => console.log("Done."))
  .finally(() => process.exit(0));
