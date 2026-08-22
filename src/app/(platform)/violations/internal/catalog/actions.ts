"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrgPermission } from "@/server/api-guard";
import { PERMISSIONS } from "@/server/permissions";
import { writeAuditLog } from "@/server/audit";

const typeSchema = z.object({
  labelVi: z.string().min(1).max(300),
  labelZh: z.string().max(300).optional(),
});

export async function createViolationTypeAction(formData: FormData) {
  const ctx = await requireOrgPermission(PERMISSIONS.VIOLATION_MANAGE);
  const parsed = typeSchema.parse({
    labelVi: formData.get("labelVi"),
    labelZh: formData.get("labelZh") || undefined,
  });

  const count = await prisma.violationType.count({ where: { organizationId: ctx.organizationId } });
  const created = await prisma.violationType.create({
    data: { organizationId: ctx.organizationId, ...parsed, sortOrder: count },
  });

  await writeAuditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    module: "violation",
    recordType: "ViolationType",
    recordId: created.id,
    action: "create",
  });

  revalidatePath("/violations/internal/catalog");
}

export async function toggleViolationTypeActiveAction(formData: FormData) {
  const ctx = await requireOrgPermission(PERMISSIONS.VIOLATION_MANAGE);
  const id = String(formData.get("id"));
  const nextIsActive = formData.get("isActive") === "true";

  const row = await prisma.violationType.findUnique({ where: { id } });
  if (!row || row.organizationId !== ctx.organizationId) return;

  await prisma.violationType.update({ where: { id }, data: { isActive: nextIsActive } });
  revalidatePath("/violations/internal/catalog");
}

const officerSchema = z.object({
  employeeId: z.string().min(1),
  monthlySubsidyVnd: z.coerce.number().int().min(0),
});

export async function addSafetyOfficerAction(formData: FormData) {
  const ctx = await requireOrgPermission(PERMISSIONS.VIOLATION_MANAGE);
  const parsed = officerSchema.parse({
    employeeId: formData.get("employeeId"),
    monthlySubsidyVnd: formData.get("monthlySubsidyVnd"),
  });

  const employee = await prisma.employee.findUnique({ where: { id: parsed.employeeId } });
  if (!employee || employee.organizationId !== ctx.organizationId) return;

  const count = await prisma.safetyOfficer.count({ where: { organizationId: ctx.organizationId } });
  const created = await prisma.safetyOfficer.upsert({
    where: { organizationId_employeeId: { organizationId: ctx.organizationId, employeeId: parsed.employeeId } },
    update: { isActive: true, monthlySubsidyVnd: parsed.monthlySubsidyVnd },
    create: {
      organizationId: ctx.organizationId,
      employeeId: parsed.employeeId,
      monthlySubsidyVnd: parsed.monthlySubsidyVnd,
      sortOrder: count,
    },
  });

  await writeAuditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    module: "violation",
    recordType: "SafetyOfficer",
    recordId: created.id,
    action: "create",
  });

  revalidatePath("/violations/internal/catalog");
}

const updateSubsidySchema = z.object({
  id: z.string().min(1),
  monthlySubsidyVnd: z.coerce.number().int().min(0),
});

export async function updateSafetyOfficerSubsidyAction(formData: FormData) {
  const ctx = await requireOrgPermission(PERMISSIONS.VIOLATION_MANAGE);
  const parsed = updateSubsidySchema.parse({
    id: formData.get("id"),
    monthlySubsidyVnd: formData.get("monthlySubsidyVnd"),
  });

  const row = await prisma.safetyOfficer.findUnique({ where: { id: parsed.id } });
  if (!row || row.organizationId !== ctx.organizationId) return;

  await prisma.safetyOfficer.update({ where: { id: parsed.id }, data: { monthlySubsidyVnd: parsed.monthlySubsidyVnd } });
  revalidatePath("/violations/internal/catalog");
}

export async function toggleSafetyOfficerActiveAction(formData: FormData) {
  const ctx = await requireOrgPermission(PERMISSIONS.VIOLATION_MANAGE);
  const id = String(formData.get("id"));
  const nextIsActive = formData.get("isActive") === "true";

  const row = await prisma.safetyOfficer.findUnique({ where: { id } });
  if (!row || row.organizationId !== ctx.organizationId) return;

  await prisma.safetyOfficer.update({ where: { id }, data: { isActive: nextIsActive } });
  revalidatePath("/violations/internal/catalog");
}
