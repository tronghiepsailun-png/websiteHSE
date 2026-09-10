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

export type DeductionRowState = { error: string } | { success: true; year: number; month: number } | undefined;

const rowSchema = z.object({
  deductionId: z.string().optional(),
  employeeId: z.string().min(1),
  accidentDate: z.string().min(1),
  reporterName: z.string().optional(),
  fineAmountVnd: z.coerce.number().int().min(0),
});

/** One inline table row's Save — mirrors the CAPA compact-row pattern: picking the employee
 *  snapshots their department/position fields onto the row at that moment (same reasoning as
 *  Incident's own *Snapshot fields), so the row keeps reading correctly even if that employee
 *  later transfers department. */
export async function saveWorkInjuryDeductionAction(_prev: DeductionRowState, formData: FormData): Promise<DeductionRowState> {
  const isUpdate = !!formData.get("deductionId");
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

  // The period a row belongs to is always the month the accident actually happened in — same
  // convention as the source workbook (each monthly sheet only ever held that month's own
  // accidents) — never whichever month tab happened to be open when the row was added/edited.
  const accidentDate = new Date(data.accidentDate);
  const periodYear = accidentDate.getFullYear();
  const periodMonth = accidentDate.getMonth() + 1;

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
    accidentDate,
    reporterName: data.reporterName?.trim() || null,
    fineAmountVnd: data.fineAmountVnd,
  };

  let deductionId: string;
  if (isUpdate) {
    deductionId = data.deductionId!;
    const before = await prisma.workInjuryDeduction.findUnique({ where: { id: deductionId } });
    assertBelongsToOrg(before, ctx.organizationId);
    await prisma.workInjuryDeduction.update({ where: { id: deductionId }, data: fields });
    await writeAuditLog({ organizationId: ctx.organizationId, userId: ctx.userId, module: "work-injury-deduction", recordType: "WorkInjuryDeduction", recordId: deductionId, action: "update" });
  } else {
    const created = await prisma.workInjuryDeduction.create({ data: { ...fields, organizationId: ctx.organizationId, createdById: ctx.userId } });
    deductionId = created.id;
    await writeAuditLog({ organizationId: ctx.organizationId, userId: ctx.userId, module: "work-injury-deduction", recordType: "WorkInjuryDeduction", recordId: deductionId, action: "create" });
  }

  revalidatePath("/violations/lien-de");
  return { success: true, year: periodYear, month: periodMonth };
}

export async function deleteWorkInjuryDeductionAction(deductionId: string) {
  const ctx = await requireOrgPermission(PERMISSIONS.VIOLATION_DELETE);

  const deduction = await prisma.workInjuryDeduction.findUnique({ where: { id: deductionId } });
  assertBelongsToOrg(deduction, ctx.organizationId);

  await prisma.workInjuryDeduction.delete({ where: { id: deductionId } });
  await writeAuditLog({ organizationId: ctx.organizationId, userId: ctx.userId, module: "work-injury-deduction", recordType: "WorkInjuryDeduction", recordId: deductionId, action: "delete" });

  revalidatePath("/violations/lien-de");
}
