"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrgPermission } from "@/server/api-guard";
import { PERMISSIONS } from "@/server/permissions";
import { ATTENDANCE_STATUSES, DEFAULT_SHIFT_HOURS } from "@/server/attendance";

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

  revalidatePath("/employees/security/attendance");
}
