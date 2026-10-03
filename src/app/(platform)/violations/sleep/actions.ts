"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrgPermission } from "@/server/api-guard";
import { PERMISSIONS } from "@/server/permissions";
import { writeAuditLog } from "@/server/audit";
import { assertBelongsToOrg } from "@/server/org-context";
import { properCaseName, SLEEP_MODULE } from "@/server/sleep-violations";
import { getLocale } from "@/lib/i18n/get-locale.server";
import { t } from "@/lib/i18n/translate";

export type SleepEmployeeDetails = {
  id: string;
  employeeCode: string;
  name: string;
  factory: string | null;
  department: string | null;
  position: string | null;
};

/** What picking an employee fills in: the name as the sheet writes it, plus factory (区域),
 *  department (二级部门) and position from the roster. */
export async function getSleepEmployeeDetailsAction(employeeId: string): Promise<SleepEmployeeDetails | null> {
  const ctx = await requireOrgPermission(PERMISSIONS.VIOLATION_EDIT);
  const e = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, organizationId: true, employeeCode: true, fullName: true, region: true, orgUnitLevel2: true, position: true },
  });
  if (!e || e.organizationId !== ctx.organizationId) return null;
  return { id: e.id, employeeCode: e.employeeCode, name: properCaseName(e.fullName), factory: e.region, department: e.orgUnitLevel2, position: e.position };
}

const text = (max: number) => z.string().trim().max(max).optional().nullable();
const amount = z.number().int().min(0).max(1_000_000_000).optional().nullable();

const schema = z.object({
  id: z.string().optional().nullable(),
  checkDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkTime: text(10),
  location: text(200),
  employeeId: text(50),
  employeeCode: text(50),
  employeeName: z.string().trim().min(1).max(200),
  factory: text(100),
  department: text(100),
  position: text(100),
  fineAmountVnd: amount,
  note: text(1000),
  liableEmployeeId: text(50),
  liableCode: text(50),
  liableName: text(200),
  liableFineVnd: amount,
  guardCatalogId: text(50),
  guardRewardVnd: amount,
  remark: text(500),
});

export type SleepViolationInput = z.input<typeof schema>;
export type SleepSaveResult = { error: string } | { success: true; year: number; month: number };

export async function saveSleepViolationAction(input: SleepViolationInput): Promise<SleepSaveResult> {
  const ctx = await requireOrgPermission(PERMISSIONS.VIOLATION_EDIT);
  const locale = await getLocale();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: t(locale, "common.invalidInput") };
  const d = parsed.data;

  // The guard's code/names/color are copied from the catalog entry at save time, so the row
  // keeps printing the same even if that entry is later renamed or recolored.
  let guard: { code: string | null; nameVi: string; nameZh: string | null; color: string | null } | null = null;
  if (d.guardCatalogId) {
    const g = await prisma.catalogItem.findUnique({ where: { id: d.guardCatalogId } });
    if (!g || g.organizationId !== ctx.organizationId || g.module !== SLEEP_MODULE || g.kind !== "guard") return { error: t(locale, "common.invalidInput") };
    guard = g;
  }

  const checkDate = new Date(`${d.checkDate}T00:00:00.000Z`);
  const fields = {
    periodYear: checkDate.getUTCFullYear(),
    periodMonth: checkDate.getUTCMonth() + 1,
    checkDate,
    checkTime: d.checkTime || null,
    location: d.location || null,
    employeeId: d.employeeId || null,
    employeeCode: d.employeeCode || null,
    employeeName: d.employeeName,
    factory: d.factory || null,
    department: d.department || null,
    position: d.position || null,
    fineAmountVnd: d.fineAmountVnd ?? null,
    note: d.note || null,
    liableEmployeeId: d.liableEmployeeId || null,
    liableCode: d.liableCode || null,
    liableName: d.liableName || null,
    liableFineVnd: d.liableFineVnd ?? null,
    guardCatalogId: d.guardCatalogId || null,
    guardCode: guard?.code ?? null,
    guardNameVi: guard?.nameVi ?? null,
    guardNameZh: guard?.nameZh ?? null,
    guardColor: guard?.color ?? null,
    guardRewardVnd: d.guardRewardVnd ?? null,
    remark: d.remark || null,
  };

  let id: string;
  if (d.id) {
    const before = await prisma.sleepViolation.findUnique({ where: { id: d.id } });
    assertBelongsToOrg(before, ctx.organizationId);
    await prisma.sleepViolation.update({ where: { id: d.id }, data: fields });
    id = d.id;
  } else {
    id = (await prisma.sleepViolation.create({ data: { ...fields, organizationId: ctx.organizationId, createdById: ctx.userId } })).id;
  }
  await writeAuditLog({ organizationId: ctx.organizationId, userId: ctx.userId, module: "violation", recordType: "SleepViolation", recordId: id, action: d.id ? "update" : "create" });

  revalidatePath("/violations/sleep");
  return { success: true, year: fields.periodYear, month: fields.periodMonth };
}

export async function deleteSleepViolationAction(id: string) {
  const ctx = await requireOrgPermission(PERMISSIONS.VIOLATION_DELETE);
  const row = await prisma.sleepViolation.findUnique({ where: { id } });
  assertBelongsToOrg(row, ctx.organizationId);
  await prisma.sleepViolation.delete({ where: { id } });
  await writeAuditLog({ organizationId: ctx.organizationId, userId: ctx.userId, module: "violation", recordType: "SleepViolation", recordId: id, action: "delete" });
  revalidatePath("/violations/sleep");
}
