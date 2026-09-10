"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrgPermission } from "@/server/api-guard";
import { PERMISSIONS } from "@/server/permissions";
import { writeAuditLog } from "@/server/audit";

const contentSchema = z.object({
  labelVi: z.string().min(1).max(300),
  labelZh: z.string().max(300).optional(),
});

export async function createSafety5sViolationContentAction(formData: FormData) {
  const ctx = await requireOrgPermission(PERMISSIONS.VIOLATION_EDIT);
  const parsed = contentSchema.parse({
    labelVi: formData.get("labelVi"),
    labelZh: formData.get("labelZh") || undefined,
  });

  const count = await prisma.safety5sViolationContent.count({ where: { organizationId: ctx.organizationId } });
  const created = await prisma.safety5sViolationContent.create({
    data: { organizationId: ctx.organizationId, ...parsed, sortOrder: count },
  });

  await writeAuditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    module: "violation",
    recordType: "Safety5sViolationContent",
    recordId: created.id,
    action: "create",
  });

  revalidatePath("/violations/5s/catalog");
}

export async function toggleSafety5sViolationContentActiveAction(formData: FormData) {
  const ctx = await requireOrgPermission(PERMISSIONS.VIOLATION_EDIT);
  const id = String(formData.get("id"));
  const nextIsActive = formData.get("isActive") === "true";

  const row = await prisma.safety5sViolationContent.findUnique({ where: { id } });
  if (!row || row.organizationId !== ctx.organizationId) return;

  await prisma.safety5sViolationContent.update({ where: { id }, data: { isActive: nextIsActive } });
  revalidatePath("/violations/5s/catalog");
}
