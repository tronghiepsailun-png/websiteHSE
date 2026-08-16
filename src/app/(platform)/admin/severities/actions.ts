"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrgPermission } from "@/server/api-guard";
import { PERMISSIONS } from "@/server/permissions";
import { writeAuditLog } from "@/server/audit";

const schema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(60),
  rank: z.coerce.number().int().min(1).max(100),
  colorHex: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional()
    .or(z.literal("")),
});

export async function createIncidentSeverityAction(formData: FormData) {
  const ctx = await requireOrgPermission(PERMISSIONS.CONFIG_MANAGE);
  const parsed = schema.parse({
    code: formData.get("code"),
    name: formData.get("name"),
    rank: formData.get("rank"),
    colorHex: formData.get("colorHex") || undefined,
  });

  const created = await prisma.incidentSeverity.create({
    data: { organizationId: ctx.organizationId, ...parsed, colorHex: parsed.colorHex || null },
  });

  await writeAuditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    module: "configuration",
    recordType: "IncidentSeverity",
    recordId: created.id,
    action: "create",
  });

  revalidatePath("/admin/severities");
}

export async function toggleIncidentSeverityActiveAction(formData: FormData) {
  const ctx = await requireOrgPermission(PERMISSIONS.CONFIG_MANAGE);
  const id = String(formData.get("id"));
  const nextIsActive = formData.get("isActive") === "true";

  const severity = await prisma.incidentSeverity.findUnique({ where: { id } });
  if (!severity || severity.organizationId !== ctx.organizationId) return;

  await prisma.incidentSeverity.update({ where: { id }, data: { isActive: nextIsActive } });
  revalidatePath("/admin/severities");
}
