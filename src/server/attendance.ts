import { prisma } from "@/lib/prisma";
import { DEFAULT_SHIFT_HOURS } from "@/lib/attendance-constants";

export { DEFAULT_SHIFT_HOURS } from "@/lib/attendance-constants";

export const ATTENDANCE_STATUSES = ["day", "night", "off"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

/** The 3-team round-robin the user specified by example rather than by abstract rule: "hiện
 *  tại là ca B (ngày), tiếp theo ca C (đêm), tiếp theo ca A (ngày)". Every 12h slot is worked
 *  by exactly one team, in this fixed order, giving each team exactly 24h rest between its own
 *  12h shifts — "đi ca 12 nghỉ 24". Anchored once here; the formula is periodic so it computes
 *  correctly for any date, before or after the anchor, with no per-day rows needed until an
 *  actual exception (swap, sick leave, ...) is recorded. */
const ANCHOR_DATE_UTC = Date.UTC(2026, 7, 22); // 2026-08-22 — the day-shift on this date is team B
const TEAM_ROTATION = ["B", "C", "A"] as const;

function mod(n: number, m: number) {
  return ((n % m) + m) % m;
}

function dateOnlyUTC(date: Date) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** teamCode is the employee's `shift` field (A/B/C). Returns the default status for that team
 *  on that date, before any manual override is applied. */
export function computeDefaultStatus(teamCode: string | null, date: Date): AttendanceStatus {
  if (!teamCode || !(TEAM_ROTATION as readonly string[]).includes(teamCode)) return "off";
  const dayOffset = Math.round((dateOnlyUTC(date) - ANCHOR_DATE_UTC) / 86_400_000);
  const dayTeam = TEAM_ROTATION[mod(2 * dayOffset, 3)];
  const nightTeam = TEAM_ROTATION[mod(2 * dayOffset + 1, 3)];
  if (teamCode === dayTeam) return "day";
  if (teamCode === nightTeam) return "night";
  return "off";
}

export async function listSecurityGuards(organizationId: string) {
  return prisma.employee.findMany({
    where: { organizationId, position: "保安", status: "active" },
    orderBy: [{ shift: "asc" }, { fullName: "asc" }],
    select: { id: true, employeeCode: true, fullName: true, fullNameZh: true, shift: true },
  });
}

export type DayCell = {
  date: Date;
  status: AttendanceStatus;
  /** The rotation's raw answer for this date, ignoring any override — lets the UI know what
   *  "ON" should mean (day or night) even on a date currently overridden to "off". */
  defaultStatus: AttendanceStatus;
  isOverride: boolean;
  notes: string | null;
  /** Actual worked hours for a working day — DEFAULT_SHIFT_HOURS unless manually adjusted. */
  hours: number;
};

/** For each guard, one cell per day of the given month — the stored override if one exists
 *  for that (employee, date), otherwise the computed rotation default. */
export async function getAttendanceMonth(organizationId: string, year: number, month: number) {
  const guards = await listSecurityGuards(organizationId);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 1));

  const overrides = await prisma.attendanceRecord.findMany({
    where: { organizationId, date: { gte: monthStart, lt: monthEnd }, employeeId: { in: guards.map((g) => g.id) } },
  });
  const overrideByKey = new Map(
    overrides.map((o) => [
      `${o.employeeId}|${o.date.toISOString().slice(0, 10)}`,
      { status: o.status as AttendanceStatus, notes: o.notes, hours: o.hours },
    ])
  );

  const rows = guards.map((guard) => {
    const cells: DayCell[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(Date.UTC(year, month - 1, day));
      const key = `${guard.id}|${date.toISOString().slice(0, 10)}`;
      const override = overrideByKey.get(key);
      const defaultStatus = computeDefaultStatus(guard.shift, date);
      cells.push({
        date,
        status: override?.status ?? defaultStatus,
        defaultStatus,
        isOverride: override !== undefined,
        notes: override?.notes ?? null,
        hours: override?.hours ?? DEFAULT_SHIFT_HOURS,
      });
    }
    return { guard, cells };
  });

  return { year, month, daysInMonth, rows };
}

export function availableAttendanceMonths(): { year: number; month: number }[] {
  // Centered on the current month rather than only looking backward (like other modules'
  // month pickers) — the rotation is generated forward from today, so upcoming months are
  // just as relevant to plan against as past ones.
  const now = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 3 + i, 1);
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  });
}

export function getAttendanceStats(rows: { cells: DayCell[] }[]) {
  let day = 0;
  let night = 0;
  let off = 0;
  for (const row of rows) {
    for (const cell of row.cells) {
      if (cell.status === "day") day++;
      else if (cell.status === "night") night++;
      else off++;
    }
  }
  return { day, night, off };
}
