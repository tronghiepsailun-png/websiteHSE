"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrgPermission } from "@/server/api-guard";
import { PERMISSIONS } from "@/server/permissions";
import { writeAuditLog } from "@/server/audit";
import { HSE_TARGET_METRIC } from "@/server/incident-reports";

function revalidateAll() {
  revalidatePath("/admin/hse-targets");
  revalidatePath("/incidents");
}

const createWorkshopSchema = z.object({
  code: z.string().min(1).max(60),
  name: z.string().min(1).max(120),
  groupName: z.string().min(1).max(120),
  safetyCategory: z.string().max(20).optional(),
  sortOrder: z.coerce.number().int().min(0),
});

export async function createSafetyWorkshopAction(formData: FormData) {
  const ctx = await requireOrgPermission(PERMISSIONS.CONFIG_MANAGE);
  const parsed = createWorkshopSchema.parse({
    code: formData.get("code"),
    name: formData.get("name"),
    groupName: formData.get("groupName"),
    safetyCategory: formData.get("safetyCategory") || undefined,
    sortOrder: formData.get("sortOrder"),
  });

  const created = await prisma.safetyWorkshop.create({ data: { organizationId: ctx.organizationId, ...parsed } });

  await writeAuditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    module: "hse_target",
    recordType: "SafetyWorkshop",
    recordId: created.id,
    action: "create",
  });

  revalidateAll();
}

export async function toggleSafetyWorkshopActiveAction(formData: FormData) {
  const ctx = await requireOrgPermission(PERMISSIONS.CONFIG_MANAGE);
  const id = String(formData.get("id"));
  const nextIsActive = formData.get("isActive") === "true";

  const row = await prisma.safetyWorkshop.findUnique({ where: { id } });
  if (!row || row.organizationId !== ctx.organizationId) return;

  await prisma.safetyWorkshop.update({ where: { id }, data: { isActive: nextIsActive } });
  revalidateAll();
}

const aliasSchema = z.object({
  id: z.string().min(1),
  safetyWorkshopId: z.string().min(1).nullable(),
});

export async function updateDepartmentAliasAction(formData: FormData) {
  const ctx = await requireOrgPermission(PERMISSIONS.CONFIG_MANAGE);
  const raw = formData.get("safetyWorkshopId");
  const parsed = aliasSchema.parse({
    id: formData.get("id"),
    safetyWorkshopId: raw === "" || raw === "unclassified" ? null : raw,
  });

  const row = await prisma.departmentAlias.findUnique({ where: { id: parsed.id } });
  if (!row || row.organizationId !== ctx.organizationId) return;

  await prisma.departmentAlias.update({ where: { id: parsed.id }, data: { safetyWorkshopId: parsed.safetyWorkshopId } });

  await writeAuditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    module: "hse_target",
    recordType: "DepartmentAlias",
    recordId: parsed.id,
    action: "update",
  });

  revalidateAll();
}

const workshopTargetsSchema = z.object({
  safetyWorkshopId: z.string().min(1),
  year: z.coerce.number().int(),
  priorYearActual: z.coerce.number().optional(),
  priorYearTarget: z.coerce.number().optional(),
  currentYearTarget: z.coerce.number().optional(),
});

// Prisma's compound-unique WhereUniqueInput requires safetyWorkshopId to be a plain string
// (even though the column is nullable), since SQL unique indexes don't match NULL = NULL —
// so upsert() can't target the null (factory-wide) row directly. find-then-write instead.
async function upsertTarget(organizationId: string, safetyWorkshopId: string | null, year: number, metricKey: string, value: number | undefined) {
  if (value === undefined || Number.isNaN(value)) return;
  const existing = await prisma.hseYearlyTarget.findFirst({ where: { organizationId, safetyWorkshopId, year, metricKey } });
  if (existing) {
    await prisma.hseYearlyTarget.update({ where: { id: existing.id }, data: { value } });
  } else {
    await prisma.hseYearlyTarget.create({ data: { organizationId, safetyWorkshopId, year, metricKey, value } });
  }
}

export async function saveWorkshopTargetsAction(formData: FormData) {
  const ctx = await requireOrgPermission(PERMISSIONS.CONFIG_MANAGE);
  const parsed = workshopTargetsSchema.parse({
    safetyWorkshopId: formData.get("safetyWorkshopId"),
    year: formData.get("year"),
    priorYearActual: formData.get("priorYearActual") || undefined,
    priorYearTarget: formData.get("priorYearTarget") || undefined,
    currentYearTarget: formData.get("currentYearTarget") || undefined,
  });

  const workshop = await prisma.safetyWorkshop.findUnique({ where: { id: parsed.safetyWorkshopId } });
  if (!workshop || workshop.organizationId !== ctx.organizationId) return;

  await Promise.all([
    upsertTarget(ctx.organizationId, parsed.safetyWorkshopId, parsed.year - 1, HSE_TARGET_METRIC.deductionActual, parsed.priorYearActual),
    upsertTarget(ctx.organizationId, parsed.safetyWorkshopId, parsed.year - 1, HSE_TARGET_METRIC.deductionTarget, parsed.priorYearTarget),
    upsertTarget(ctx.organizationId, parsed.safetyWorkshopId, parsed.year, HSE_TARGET_METRIC.deductionTarget, parsed.currentYearTarget),
  ]);

  await writeAuditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    module: "hse_target",
    recordType: "HseYearlyTarget",
    recordId: parsed.safetyWorkshopId,
    action: "update",
  });

  revalidateAll();
}

const kpiTargetsSchema = z.object({
  kpiCode: z.string().min(1),
  year: z.coerce.number().int(),
  target: z.coerce.number().optional(),
  actualOverride: z.coerce.number().optional(),
  monthly: z.array(z.coerce.number().optional()).length(12),
});

export async function saveKpiTargetsAction(formData: FormData) {
  const ctx = await requireOrgPermission(PERMISSIONS.CONFIG_MANAGE);
  const monthly = Array.from({ length: 12 }, (_, i) => {
    const raw = formData.get(`m${String(i + 1).padStart(2, "0")}`);
    return raw === "" || raw === null ? undefined : Number(raw);
  });
  const parsed = kpiTargetsSchema.parse({
    kpiCode: formData.get("kpiCode"),
    year: formData.get("year"),
    target: formData.get("target") || undefined,
    actualOverride: formData.get("actualOverride") || undefined,
    monthly,
  });

  await upsertTarget(ctx.organizationId, null, parsed.year, `kpi_${parsed.kpiCode}_target`, parsed.target);
  await upsertTarget(ctx.organizationId, null, parsed.year, `kpi_${parsed.kpiCode}_actual_override`, parsed.actualOverride);
  await Promise.all(
    parsed.monthly.map((v, i) =>
      upsertTarget(ctx.organizationId, null, parsed.year, `kpi_${parsed.kpiCode}_m${String(i + 1).padStart(2, "0")}`, v)
    )
  );

  await writeAuditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    module: "hse_target",
    recordType: "HseYearlyTarget",
    recordId: parsed.kpiCode,
    action: "update",
  });

  revalidateAll();
}
