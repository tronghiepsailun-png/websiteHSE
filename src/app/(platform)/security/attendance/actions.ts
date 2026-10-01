"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrgPermission } from "@/server/api-guard";
import { PERMISSIONS } from "@/server/permissions";
import { ATTENDANCE_STATUSES, DEFAULT_SHIFT_HOURS, TEAMS, deleteGuardTeamChange, setGuardTeam, teamsOnDate } from "@/server/attendance";
import { writeAuditLog } from "@/server/audit";
import { getLocale } from "@/lib/i18n/get-locale.server";
import { t } from "@/lib/i18n/translate";

const setStatusSchema = z.object({
  employeeId: z.string().min(1),
  date: z.string().min(1), // YYYY-MM-DD
  status: z.enum(ATTENDANCE_STATUSES),
  hours: z.number().int().min(1).max(24),
  notes: z.string().optional(),
});

/** Opened from the calendar cell's popover — always writes an explicit override, even when the
 *  chosen status/hours happen to match that day's computed default, so what actually happened
 *  (and why, via notes) is recorded rather than left to a formula that could change
 *  interpretation later. */
export async function setAttendanceStatusAction(
  employeeId: string,
  date: string,
  status: string,
  hours: number,
  notes: string
) {
  const ctx = await requireOrgPermission(PERMISSIONS.SECURITY_EDIT);
  const parsed = setStatusSchema.safeParse({ employeeId, date, status, hours, notes });
  if (!parsed.success) return;

  const employee = await prisma.employee.findUnique({ where: { id: parsed.data.employeeId }, select: { organizationId: true } });
  if (!employee || employee.organizationId !== ctx.organizationId) return;

  const dateOnly = new Date(`${parsed.data.date}T00:00:00.000Z`);
  const noteValue = parsed.data.notes?.trim() || null;
  const hoursValue = parsed.data.status === "off" ? DEFAULT_SHIFT_HOURS : parsed.data.hours;

  await prisma.attendanceRecord.upsert({
    where: { organizationId_employeeId_date: { organizationId: ctx.organizationId, employeeId: parsed.data.employeeId, date: dateOnly } },
    create: {
      organizationId: ctx.organizationId,
      employeeId: parsed.data.employeeId,
      date: dateOnly,
      status: parsed.data.status,
      hours: hoursValue,
      notes: noteValue,
    },
    update: { status: parsed.data.status, hours: hoursValue, notes: noteValue },
  });

  revalidatePath("/security/attendance");
}

const changeTeamSchema = z.object({
  employeeId: z.string().min(1),
  team: z.enum(TEAMS),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  swapWithId: z.string().optional(),
  notes: z.string().max(300).optional(),
});

export type TeamChangeResult = { error: string } | { success: true };

/** Moves a guard to another team (A/B/C) from a chosen date on — the months before stay exactly
 *  as they were. With `swapWithId`, the other guard takes this guard's old team from the same
 *  date (the usual "hai người đổi ca cho nhau"). */
export async function changeGuardTeamAction(input: z.input<typeof changeTeamSchema>): Promise<TeamChangeResult> {
  const ctx = await requireOrgPermission(PERMISSIONS.SECURITY_EDIT);
  const locale = await getLocale();
  const parsed = changeTeamSchema.safeParse(input);
  if (!parsed.success) return { error: t(locale, "common.invalidInput") };
  const { employeeId, team, effectiveFrom, swapWithId } = parsed.data;
  const notes = parsed.data.notes?.trim() || null;
  const date = new Date(`${effectiveFrom}T00:00:00.000Z`);

  const ids = swapWithId ? [employeeId, swapWithId] : [employeeId];
  const employees = await prisma.employee.findMany({ where: { id: { in: ids }, organizationId: ctx.organizationId }, select: { id: true, shift: true } });
  if (employees.length !== new Set(ids).size || (swapWithId && swapWithId === employeeId)) return { error: t(locale, "common.invalidInput") };

  const teams = await teamsOnDate(ctx.organizationId, date);
  const oldTeam = teams.get(employeeId) ?? null;
  const moves: { id: string; from: string | null; to: (typeof TEAMS)[number] }[] = [{ id: employeeId, from: oldTeam, to: team }];
  if (swapWithId) {
    const partnerTeam = teams.get(swapWithId) ?? null;
    if (!oldTeam || !(TEAMS as readonly string[]).includes(oldTeam) || partnerTeam === oldTeam) return { error: t(locale, "attendance.teamChange.errorSwap") };
    moves.push({ id: swapWithId, from: partnerTeam, to: oldTeam as (typeof TEAMS)[number] });
  }

  for (const move of moves) {
    const shift = employees.find((e) => e.id === move.id)?.shift ?? null;
    await setGuardTeam(ctx.organizationId, move.id, move.to, date, shift, notes);
    await writeAuditLog({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      module: "employee",
      recordType: "Employee",
      recordId: move.id,
      action: "update",
      changes: [{ field: "shift", oldValue: move.from, newValue: `${move.to} (từ ${effectiveFrom})` }],
    });
  }

  revalidatePath("/security/attendance");
  revalidatePath("/employees");
  return { success: true };
}

/** Undoes one recorded team change. */
export async function deleteGuardTeamChangeAction(assignmentId: string): Promise<TeamChangeResult> {
  const ctx = await requireOrgPermission(PERMISSIONS.SECURITY_EDIT);
  const removed = await deleteGuardTeamChange(ctx.organizationId, assignmentId);
  if (!removed) return { error: t(await getLocale(), "common.invalidInput") };
  await writeAuditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    module: "employee",
    recordType: "Employee",
    recordId: removed.employeeId,
    action: "update",
    changes: [{ field: "shift", oldValue: `${removed.team} (từ ${removed.effectiveFrom.toISOString().slice(0, 10)})`, newValue: "(hủy)" }],
  });
  revalidatePath("/security/attendance");
  revalidatePath("/employees");
  return { success: true };
}
