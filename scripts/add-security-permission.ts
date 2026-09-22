// One-off, idempotent: adds the new security.view/security.edit permissions (for the
// "Quản lý bảo an" module, previously ungated) and grants them to every role that already
// has employee.view/employee.edit, so nobody's current access silently breaks on deploy.
// Safe to run against production — only touches the permissions/role_permissions tables,
// never organizations/employees/etc. Run once: `npx tsx scripts/add-security-permission.ts`.

import { prisma } from "@/lib/prisma";

const NEW_PERMISSIONS = [
  { key: "security.view", module: "security", description: "View the security-guard attendance/evaluation module" },
  { key: "security.edit", module: "security", description: "Edit security-guard attendance records" },
] as const;

// [existing permission whose roles should also get the new one, new permission key]
const INHERIT_FROM: [string, string][] = [
  ["employee.view", "security.view"],
  ["employee.edit", "security.edit"],
];

async function main() {
  const permissionIds = new Map<string, string>();
  for (const p of NEW_PERMISSIONS) {
    const perm = await prisma.permission.upsert({
      where: { key: p.key },
      update: { module: p.module, description: p.description },
      create: p,
    });
    permissionIds.set(p.key, perm.id);
    console.log(`Permission ready: ${p.key} (${perm.id})`);
  }

  for (const [fromKey, toKey] of INHERIT_FROM) {
    const fromPerm = await prisma.permission.findUnique({ where: { key: fromKey } });
    if (!fromPerm) continue;
    const roles = await prisma.rolePermission.findMany({
      where: { permissionId: fromPerm.id },
      select: { roleId: true, role: { select: { key: true, name: true } } },
    });
    const toPermissionId = permissionIds.get(toKey)!;
    for (const r of roles) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: r.roleId, permissionId: toPermissionId } },
        update: {},
        create: { roleId: r.roleId, permissionId: toPermissionId },
      });
      console.log(`Granted ${toKey} to role "${r.role.name}" (${r.role.key}) — had ${fromKey}`);
    }
  }
}

main()
  .then(() => console.log("Done."))
  .finally(() => process.exit(0));
