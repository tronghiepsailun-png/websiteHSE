"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrgPermission } from "@/server/api-guard";
import { PERMISSIONS } from "@/server/permissions";
import { writeAuditLog } from "@/server/audit";

const createSchema = z.object({
  safetyOfficerId: z.string().min(1),
  violationTypeId: z.string().min(1),
  occurredAt: z.string().min(1),
  amountVnd: z.coerce.number().int().min(0),
  note: z.string().max(500).optional(),
});

export type CreateViolationState = { error?: string; fieldErrors?: Record<string, string> } | undefined;

export async function createViolationAction(_prev: CreateViolationState, formData: FormData): Promise<CreateViolationState> {
  const ctx = await requireOrgPermission(PERMISSIONS.VIOLATION_MANAGE);

  const parsed = createSchema.safeParse({
    safetyOfficerId: formData.get("safetyOfficerId"),
    violationTypeId: formData.get("violationTypeId"),
    occurredAt: formData.get("occurredAt"),
    amountVnd: formData.get("amountVnd"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) {
    return { error: "Vui lòng kiểm tra lại các trường bắt buộc." };
  }

  const officer = await prisma.safetyOfficer.findUnique({ where: { id: parsed.data.safetyOfficerId } });
  if (!officer || officer.organizationId !== ctx.organizationId) {
    return { error: "Nhân viên an toàn không hợp lệ." };
  }
  const violationType = await prisma.violationType.findUnique({ where: { id: parsed.data.violationTypeId } });
  if (!violationType || violationType.organizationId !== ctx.organizationId) {
    return { error: "Nội dung vi phạm không hợp lệ." };
  }

  const created = await prisma.safetyViolation.create({
    data: {
      organizationId: ctx.organizationId,
      safetyOfficerId: parsed.data.safetyOfficerId,
      violationTypeId: parsed.data.violationTypeId,
      occurredAt: new Date(parsed.data.occurredAt),
      amountVnd: parsed.data.amountVnd,
      note: parsed.data.note || null,
    },
  });

  await writeAuditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    module: "violation",
    recordType: "SafetyViolation",
    recordId: created.id,
    action: "create",
  });

  revalidatePath("/violations/internal");
  return undefined;
}

export async function deleteViolationAction(id: string) {
  const ctx = await requireOrgPermission(PERMISSIONS.VIOLATION_MANAGE);

  const violation = await prisma.safetyViolation.findUnique({ where: { id } });
  if (!violation || violation.organizationId !== ctx.organizationId) return;

  await prisma.safetyViolation.delete({ where: { id } });

  await writeAuditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    module: "violation",
    recordType: "SafetyViolation",
    recordId: id,
    action: "delete",
  });

  revalidatePath("/violations/internal");
}
