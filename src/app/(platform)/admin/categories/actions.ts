"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrgPermission } from "@/server/api-guard";
import { PERMISSIONS } from "@/server/permissions";
import { writeAuditLog } from "@/server/audit";

const schema = z.object({
  code: z.string().min(1).max(30),
  name: z.string().min(1).max(80),
  description: z.string().max(300).optional(),
});

export async function createIncidentCategoryAction(formData: FormData) {
  const ctx = await requireOrgPermission(PERMISSIONS.CONFIG_MANAGE);
  const parsed = schema.parse({
    code: formData.get("code"),
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });

  const created = await prisma.incidentCategory.create({ data: { organizationId: ctx.organizationId, ...parsed } });

  await writeAuditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    module: "configuration",
    recordType: "IncidentCategory",
    recordId: created.id,
    action: "create",
  });

  revalidatePath("/admin/categories");
}

export async function toggleIncidentCategoryActiveAction(formData: FormData) {
  const ctx = await requireOrgPermission(PERMISSIONS.CONFIG_MANAGE);
  const id = String(formData.get("id"));
  const nextIsActive = formData.get("isActive") === "true";

  const category = await prisma.incidentCategory.findUnique({ where: { id } });
  if (!category || category.organizationId !== ctx.organizationId) return;

  await prisma.incidentCategory.update({ where: { id }, data: { isActive: nextIsActive } });
  revalidatePath("/admin/categories");
}
