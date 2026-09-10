"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrgPermission } from "@/server/api-guard";
import { PERMISSIONS } from "@/server/permissions";
import { writeAuditLog } from "@/server/audit";
import { assertBelongsToOrg } from "@/server/org-context";
import { getLocale } from "@/lib/i18n/get-locale.server";
import { t } from "@/lib/i18n/translate";

export type ViolationRowState = { error: string } | { success: true; year: number; month: number } | undefined;

const rowSchema = z.object({
  violationId: z.string().optional(),
  safetyOfficerId: z.string().min(1),
  violationTypeId: z.string().min(1),
  occurredAt: z.string().min(1),
  amountVnd: z.coerce.number().int().min(0),
  note: z.string().max(500).optional(),
});

/** One inline table row's Save — same compact-row pattern as CAPA/"Vi phạm liên đế": clicking
 *  "Thêm vi phạm" opens the row directly in the table instead of a separate form card. The
 *  officer/department columns aren't snapshotted here (unlike liên đế) since they come from a
 *  live SafetyOfficer→Employee join, same as before this rework — only the row's own fields
 *  (date, type, amount, note) are actually stored. */
export async function saveViolationRowAction(_prev: ViolationRowState, formData: FormData): Promise<ViolationRowState> {
  const isUpdate = !!formData.get("violationId");
  const ctx = await requireOrgPermission(PERMISSIONS.VIOLATION_EDIT);
  const locale = await getLocale();

  const raw = Object.fromEntries(formData.entries());
  const parsed = rowSchema.safeParse(raw);
  if (!parsed.success) return { error: t(locale, "records.form.errorGeneric") };
  const data = parsed.data;

  const officer = await prisma.safetyOfficer.findUnique({ where: { id: data.safetyOfficerId } });
  if (!officer || officer.organizationId !== ctx.organizationId) return { error: t(locale, "violations.form.needsSetup") };
  const violationType = await prisma.violationType.findUnique({ where: { id: data.violationTypeId } });
  if (!violationType || violationType.organizationId !== ctx.organizationId) return { error: t(locale, "violations.form.needsSetup") };

  // Same convention as "Vi phạm liên đế": which month a row belongs to is always the month its
  // own date falls in, never whichever month tab happened to be open when it was added/edited.
  const occurredAt = new Date(data.occurredAt);
  const periodYear = occurredAt.getFullYear();
  const periodMonth = occurredAt.getMonth() + 1;

  const fields = {
    safetyOfficerId: data.safetyOfficerId,
    violationTypeId: data.violationTypeId,
    occurredAt,
    amountVnd: data.amountVnd,
    note: data.note?.trim() || null,
  };

  let violationId: string;
  if (isUpdate) {
    violationId = data.violationId!;
    const before = await prisma.safetyViolation.findUnique({ where: { id: violationId } });
    assertBelongsToOrg(before, ctx.organizationId);
    await prisma.safetyViolation.update({ where: { id: violationId }, data: fields });
    await writeAuditLog({ organizationId: ctx.organizationId, userId: ctx.userId, module: "violation", recordType: "SafetyViolation", recordId: violationId, action: "update" });
  } else {
    const created = await prisma.safetyViolation.create({ data: { ...fields, organizationId: ctx.organizationId } });
    violationId = created.id;
    await writeAuditLog({ organizationId: ctx.organizationId, userId: ctx.userId, module: "violation", recordType: "SafetyViolation", recordId: violationId, action: "create" });
  }

  revalidatePath("/violations/internal");
  return { success: true, year: periodYear, month: periodMonth };
}

export async function deleteViolationAction(id: string) {
  const ctx = await requireOrgPermission(PERMISSIONS.VIOLATION_DELETE);

  const violation = await prisma.safetyViolation.findUnique({ where: { id } });
  assertBelongsToOrg(violation, ctx.organizationId);

  await prisma.safetyViolation.delete({ where: { id } });
  await writeAuditLog({ organizationId: ctx.organizationId, userId: ctx.userId, module: "violation", recordType: "SafetyViolation", recordId: id, action: "delete" });

  revalidatePath("/violations/internal");
}
