"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrgPermission } from "@/server/api-guard";
import { PERMISSIONS } from "@/server/permissions";
import { writeAuditLog } from "@/server/audit";

const unitTypeSchema = z.object({
  code: z.string().min(1).max(30),
  name: z.string().min(1).max(80),
  level: z.coerce.number().int().min(0).max(20),
});

export async function createOrgUnitTypeAction(formData: FormData) {
  const ctx = await requireOrgPermission(PERMISSIONS.CONFIG_MANAGE);
  const parsed = unitTypeSchema.parse({
    code: formData.get("code"),
    name: formData.get("name"),
    level: formData.get("level"),
  });

  const created = await prisma.orgUnitType.create({
    data: { organizationId: ctx.organizationId, ...parsed },
  });

  await writeAuditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    module: "organization",
    recordType: "OrgUnitType",
    recordId: created.id,
    action: "create",
  });

  revalidatePath("/admin/org-units");
}

const unitSchema = z.object({
  code: z.string().min(1).max(40),
  name: z.string().min(1).max(120),
  unitTypeId: z.string().min(1),
  parentId: z.string().optional(),
});

export async function createOrgUnitAction(formData: FormData) {
  const ctx = await requireOrgPermission(PERMISSIONS.CONFIG_MANAGE);
  const raw = {
    code: formData.get("code"),
    name: formData.get("name"),
    unitTypeId: formData.get("unitTypeId"),
    parentId: formData.get("parentId") || undefined,
  };
  const parsed = unitSchema.parse(raw);

  const created = await prisma.orgUnit.create({
    data: {
      organizationId: ctx.organizationId,
      code: parsed.code,
      name: parsed.name,
      unitTypeId: parsed.unitTypeId,
      parentId: parsed.parentId && parsed.parentId !== "none" ? parsed.parentId : null,
    },
  });

  await writeAuditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    module: "organization",
    recordType: "OrgUnit",
    recordId: created.id,
    action: "create",
  });

  revalidatePath("/admin/org-units");
}

export async function toggleOrgUnitActiveAction(formData: FormData) {
  const ctx = await requireOrgPermission(PERMISSIONS.CONFIG_MANAGE);
  const id = String(formData.get("id"));
  const nextIsActive = formData.get("isActive") === "true";

  const unit = await prisma.orgUnit.findUnique({ where: { id } });
  if (!unit || unit.organizationId !== ctx.organizationId) return;

  await prisma.orgUnit.update({ where: { id }, data: { isActive: nextIsActive } });
  revalidatePath("/admin/org-units");
}
