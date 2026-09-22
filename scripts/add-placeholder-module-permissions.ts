// One-off, idempotent: adds view-only permissions for the 8 placeholder modules (Văn kiện
// HSE, Hồ sơ môi trường, Đặt mua, Biểu mẫu x2, 3 training modules) that were previously
// ungated (`requireApiAccess(null)` — visible to every signed-in org member regardless of
// role). Grants the new permission to every existing role, so nobody's current access
// silently breaks on deploy — the admin can then individually restrict per sub-account from
// Cài đặt hệ thống > Người dùng & Phân quyền, same as security.view/edit.
// Safe to run against production — only touches the permissions/role_permissions tables.
// Run once: `npx tsx scripts/add-placeholder-module-permissions.ts`.

import { prisma } from "@/lib/prisma";

const NEW_PERMISSIONS = [
  { key: "docs_hse.view", module: "docs_hse", description: "View the HSE documents module (placeholder)" },
  { key: "docs_environment.view", module: "docs_environment", description: "View the environment documents module (placeholder)" },
  { key: "procurement.view", module: "procurement", description: "View the procurement module (placeholder)" },
  { key: "forms.view", module: "forms", description: "View the forms module (placeholder)" },
  { key: "training_new_employees.view", module: "training_new_employees", description: "View the new-employee training module (placeholder)" },
  { key: "training_incidents.view", module: "training_incidents", description: "View the incident-training module (placeholder)" },
  { key: "training_materials.view", module: "training_materials", description: "View the training materials module (placeholder)" },
  { key: "training_forms.view", module: "training_forms", description: "View the training forms module (placeholder)" },
] as const;

async function main() {
  const roles = await prisma.role.findMany({ select: { id: true, key: true, name: true } });

  for (const p of NEW_PERMISSIONS) {
    const perm = await prisma.permission.upsert({
      where: { key: p.key },
      update: { module: p.module, description: p.description },
      create: p,
    });
    console.log(`Permission ready: ${p.key} (${perm.id})`);

    for (const role of roles) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
        update: {},
        create: { roleId: role.id, permissionId: perm.id },
      });
    }
    console.log(`Granted ${p.key} to ${roles.length} role(s).`);
  }
}

main()
  .then(() => console.log("Done."))
  .finally(() => process.exit(0));
