// One-off, idempotent: the old placeholder "Biểu mẫu" pages are replaced by the real "Thư viện
// biểu mẫu" module, which adds a forms.edit permission (add/change/delete forms and manage their
// categories). Grants forms.edit to every role that already has records.edit (the people who
// already maintain compliance documents) and forms.view to every role that had the removed
// Training "Biểu mẫu" page (training_forms.view), so nobody loses the access they had.
// Only touches the permissions/role_permissions tables — never organizations, forms or files.
// Run once: `npx tsx scripts/add-forms-edit-permission.ts`.

import { prisma } from "@/lib/prisma";

const NEW_PERMISSIONS = [{ key: "forms.edit", module: "forms", description: "Add, change, replace files of, hide or delete forms in the form library and manage its categories" }] as const;

// [existing permission whose roles should also get the new one, new permission key]
const INHERIT_FROM: [string, string][] = [
  ["records.edit", "forms.edit"],
  ["training_forms.view", "forms.view"],
];

async function main() {
  for (const p of NEW_PERMISSIONS) {
    const perm = await prisma.permission.upsert({ where: { key: p.key }, update: { module: p.module, description: p.description }, create: p });
    console.log(`Permission ready: ${p.key} (${perm.id})`);
  }

  for (const [fromKey, toKey] of INHERIT_FROM) {
    const fromPerm = await prisma.permission.findUnique({ where: { key: fromKey } });
    const toPerm = await prisma.permission.findUnique({ where: { key: toKey } });
    if (!fromPerm || !toPerm) {
      console.log(`Skipped ${fromKey} -> ${toKey} (permission row missing)`);
      continue;
    }
    const roles = await prisma.rolePermission.findMany({ where: { permissionId: fromPerm.id }, select: { roleId: true, role: { select: { key: true, name: true } } } });
    for (const r of roles) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: r.roleId, permissionId: toPerm.id } },
        update: {},
        create: { roleId: r.roleId, permissionId: toPerm.id },
      });
      console.log(`Granted ${toKey} to role "${r.role.name}" (${r.role.key}) — had ${fromKey}`);
    }
  }
}

main()
  .then(() => console.log("Done."))
  .finally(() => process.exit(0));
