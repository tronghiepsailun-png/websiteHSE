"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrgPermission } from "@/server/api-guard";
import { PERMISSIONS } from "@/server/permissions";
import { writeAuditLog } from "@/server/audit";
import { assertBelongsToOrg } from "@/server/org-context";
import { getEmployeeById } from "@/server/employees";
import { NotFoundError } from "@/server/errors";
import { getLocale } from "@/lib/i18n/get-locale.server";
import { t } from "@/lib/i18n/translate";

export type Safety5sRowState = { error: string } | { success: true; year: number; month: number } | undefined;

const rowSchema = z.object({
  violationId: z.string().optional(),
  employeeId: z.string().min(1),
  violationContent: z.string().min(1).max(500),
  violationDate: z.string().min(1),
  fineAmountVnd: z.string().optional(),
  note: z.string().max(500).optional(),
});

/** One inline table row's Save — same compact-row pattern as "Vi phạm liên đế": picking the
 *  employee snapshots their department/position fields onto the row at that moment, so the
 *  row keeps reading correctly even if that employee later transfers department. Fine amount
 *  is optional — some real rows carry a non-monetary penalty instead (see schema comment). */
export async function saveSafety5sViolationAction(_prev: Safety5sRowState, formData: FormData): Promise<Safety5sRowState> {
  const isUpdate = !!formData.get("violationId");
  const ctx = await requireOrgPermission(PERMISSIONS.VIOLATION_EDIT);
  const locale = await getLocale();

  const raw = Object.fromEntries(formData.entries());
  const parsed = rowSchema.safeParse(raw);
  if (!parsed.success) return { error: t(locale, "records.form.errorGeneric") };
  const data = parsed.data;

  let employee;
  try {
    employee = await getEmployeeById(ctx.organizationId, data.employeeId);
  } catch (error) {
    if (error instanceof NotFoundError) return { error: t(locale, "violationsLienDe.form.employeeNotFound") };
    throw error;
  }

  // The period a row belongs to is always the month the violation actually happened in — same
  // convention as the source workbook (each monthly sheet only ever held that month's own
  // violations) — never whichever month tab happened to be open when the row was added/edited.
  const violationDate = new Date(data.violationDate);
  const periodYear = violationDate.getFullYear();
  const periodMonth = violationDate.getMonth() + 1;
  const fineAmountVnd = data.fineAmountVnd?.trim() ? Number(data.fineAmountVnd) : null;

  const fields = {
    periodYear,
    periodMonth,
    employeeId: employee.id,
    employeeCodeSnapshot: employee.employeeCode,
    fullNameZhSnapshot: employee.fullNameZh,
    fullNameViSnapshot: employee.fullName,
    orgUnitLevel1Snapshot: employee.orgUnitLevel1,
    regionSnapshot: employee.region,
    orgUnitLevel2Snapshot: employee.orgUnitLevel2,
    teamSnapshot: employee.team,
    shiftSnapshot: employee.shift,
    positionSnapshot: employee.position,
    violationContent: data.violationContent.trim(),
    violationDate,
    fineAmountVnd,
    note: data.note?.trim() || null,
  };

  let violationId: string;
  if (isUpdate) {
    violationId = data.violationId!;
    const before = await prisma.safety5sViolation.findUnique({ where: { id: violationId } });
    assertBelongsToOrg(before, ctx.organizationId);
    await prisma.safety5sViolation.update({ where: { id: violationId }, data: fields });
    await writeAuditLog({ organizationId: ctx.organizationId, userId: ctx.userId, module: "violation", recordType: "Safety5sViolation", recordId: violationId, action: "update" });
  } else {
    const created = await prisma.safety5sViolation.create({ data: { ...fields, organizationId: ctx.organizationId, createdById: ctx.userId } });
    violationId = created.id;
    await writeAuditLog({ organizationId: ctx.organizationId, userId: ctx.userId, module: "violation", recordType: "Safety5sViolation", recordId: violationId, action: "create" });
  }

  revalidatePath("/violations/5s");
  return { success: true, year: periodYear, month: periodMonth };
}

export async function deleteSafety5sViolationAction(id: string) {
  const ctx = await requireOrgPermission(PERMISSIONS.VIOLATION_DELETE);

  const violation = await prisma.safety5sViolation.findUnique({ where: { id } });
  assertBelongsToOrg(violation, ctx.organizationId);

  await prisma.safety5sViolation.delete({ where: { id } });
  await writeAuditLog({ organizationId: ctx.organizationId, userId: ctx.userId, module: "violation", recordType: "Safety5sViolation", recordId: id, action: "delete" });

  revalidatePath("/violations/5s");
}
