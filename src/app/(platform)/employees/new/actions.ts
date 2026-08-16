"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrgPermission } from "@/server/api-guard";
import { PERMISSIONS } from "@/server/permissions";
import { resolveOrgUnitIdByName } from "@/server/org-units";
import { writeAuditLog } from "@/server/audit";
import { getLocale } from "@/lib/i18n/get-locale.server";
import { t } from "@/lib/i18n/translate";
import { zodFieldErrors } from "@/lib/form-errors";
import type { EmployeeFormState } from "../employee-form";

const schema = z.object({
  employeeCode: z.string().min(1),
  fullName: z.string().min(1),
  fullNameZh: z.string().optional(),
  gender: z.string().optional(),
  education: z.string().optional(),
  birthDate: z.string().optional(),
  nationalId: z.string().optional(),
  orgUnitLevel1: z.string().min(1),
  orgUnitLevel2: z.string().optional(),
  region: z.string().optional(),
  costCenterName: z.string().optional(),
  team: z.string().optional(),
  shift: z.string().optional(),
  position: z.string().optional(),
});

export async function createEmployeeAction(_prev: EmployeeFormState, formData: FormData): Promise<EmployeeFormState> {
  const ctx = await requireOrgPermission(PERMISSIONS.EMPLOYEE_MANAGE);
  const locale = await getLocale();

  const raw = Object.fromEntries(formData.entries());
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { error: t(locale, "employees.form.errorGeneric"), fieldErrors: zodFieldErrors(parsed.error) };
  const data = parsed.data;

  const orgUnitId = await resolveOrgUnitIdByName(ctx.organizationId, data.orgUnitLevel1);

  let employee;
  try {
    employee = await prisma.employee.create({
      data: {
        organizationId: ctx.organizationId,
        employeeCode: data.employeeCode.trim(),
        fullName: data.fullName,
        fullNameZh: data.fullNameZh || null,
        gender: data.gender && data.gender !== "unset" ? data.gender : null,
        education: data.education || null,
        birthDate: data.birthDate ? new Date(data.birthDate) : null,
        nationalId: data.nationalId || null,
        orgUnitLevel1: data.orgUnitLevel1,
        orgUnitLevel2: data.orgUnitLevel2 || null,
        region: data.region || null,
        costCenterName: data.costCenterName || null,
        team: data.team || null,
        shift: data.shift || null,
        position: data.position || null,
        orgUnitId,
        status: "active",
      },
    });
  } catch (err) {
    if (err instanceof Error && "code" in err && err.code === "P2002") {
      return { error: t(locale, "employees.form.errorDuplicate") };
    }
    throw err;
  }

  await writeAuditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    module: "employee",
    recordType: "Employee",
    recordId: employee.id,
    action: "create",
  });

  redirect("/employees");
}
