// One-off, idempotent: adds the new ai.use permission (AI assistant in the top bar) and grants it
// to every role that already has incident.view — i.e. the everyday users — so the button shows up
// for them; the admin can still switch it off per account in the permission matrix afterwards.
// Only touches the permissions/role_permissions tables. Run once: `npx tsx scripts/add-ai-permission.ts`.

import { prisma } from "@/lib/prisma";

async function main() {
  const perm = await prisma.permission.upsert({
    where: { key: "ai.use" },
    update: { module: "ai", description: "Use the AI assistant (Q&A and Vietnamese/Chinese translation)" },
    create: { key: "ai.use", module: "ai", description: "Use the AI assistant (Q&A and Vietnamese/Chinese translation)" },
  });
  console.log(`Permission ready: ai.use (${perm.id})`);

  const from = await prisma.permission.findUnique({ where: { key: "incident.view" } });
  if (!from) return;
  const roles = await prisma.rolePermission.findMany({ where: { permissionId: from.id }, select: { roleId: true, role: { select: { key: true, name: true } } } });
  for (const r of roles) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: r.roleId, permissionId: perm.id } },
      update: {},
      create: { roleId: r.roleId, permissionId: perm.id },
    });
    console.log(`Granted ai.use to role "${r.role.name}" (${r.role.key})`);
  }
}

main()
  .then(() => console.log("Done."))
  .finally(() => process.exit(0));
