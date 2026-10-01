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

export const TEAMS = ["A", "B", "C"] as const;
export type Team = (typeof TEAMS)[number];

export async function listSecurityGuards(organizationId: string) {
  return prisma.employee.findMany({
    where: { organizationId, position: "保安", status: "active" },
    orderBy: [{ shift: "asc" }, { fullName: "asc" }],
    select: { id: true, employeeCode: true, fullName: true, fullNameZh: true, shift: true },
  });
}

/** Stored as the first ShiftAssignment's effectiveFrom — "this was the team from the start". */
const BASELINE_DATE = new Date(Date.UTC(1970, 0, 1));

type Assignment = { id: string; team: string; effectiveFrom: Date; notes: string | null };

/** Team on `date`: the latest assignment that has started by then; with no assignments at all
 *  (the guard's team has never been changed here) it's just Employee.shift. */
function teamOn(assignments: Assignment[], fallback: string | null, date: Date): string | null {
  if (assignments.length === 0) return fallback;
  let team: string | null = null;
  for (const a of assignments) {
    if (a.effectiveFrom.getTime() <= date.getTime()) team = a.team;
    else break;
  }
  return team;
}

async function loadAssignments(organizationId: string, employeeIds: string[]) {
  const rows = await prisma.shiftAssignment.findMany({
    where: { organizationId, employeeId: { in: employeeIds } },
    orderBy: { effectiveFrom: "asc" },
  });
  const byEmployee = new Map<string, Assignment[]>();
  for (const r of rows) {
    const list = byEmployee.get(r.employeeId) ?? [];
    list.push(r);
    byEmployee.set(r.employeeId, list);
  }
  return byEmployee;
}

/** Today's date in Vietnam (UTC+7) as UTC midnight — the "today" a manager means. */
export function todayVN() {
  const now = new Date(Date.now() + 7 * 3_600_000);
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Moves a guard to `team` from `effectiveFrom` on, leaving every date before it as it was.
 *  `previousShift` is the team the guard had before (needed for the baseline row the first time
 *  a guard's team is changed). Also keeps Employee.shift equal to the latest assignment. */
export async function setGuardTeam(
  organizationId: string,
  employeeId: string,
  team: Team,
  effectiveFrom: Date,
  previousShift: string | null,
  notes: string | null = null
) {
  const existing = await prisma.shiftAssignment.count({ where: { organizationId, employeeId } });
  if (existing === 0 && previousShift && effectiveFrom.getTime() > BASELINE_DATE.getTime()) {
    await prisma.shiftAssignment.create({ data: { organizationId, employeeId, team: previousShift, effectiveFrom: BASELINE_DATE } });
  }
  await prisma.shiftAssignment.upsert({
    where: { organizationId_employeeId_effectiveFrom: { organizationId, employeeId, effectiveFrom } },
    create: { organizationId, employeeId, team, effectiveFrom, notes },
    update: { team, notes },
  });
  await syncEmployeeShift(organizationId, employeeId);
}

/** Undoes one team change (never the baseline row). */
export async function deleteGuardTeamChange(organizationId: string, assignmentId: string) {
  const row = await prisma.shiftAssignment.findUnique({ where: { id: assignmentId } });
  if (!row || row.organizationId !== organizationId || row.effectiveFrom.getTime() === BASELINE_DATE.getTime()) return null;
  await prisma.shiftAssignment.delete({ where: { id: assignmentId } });
  // Only the baseline left → no change remains, go back to plain Employee.shift.
  const remaining = await prisma.shiftAssignment.findMany({ where: { organizationId, employeeId: row.employeeId } });
  if (remaining.length === 1 && remaining[0].effectiveFrom.getTime() === BASELINE_DATE.getTime()) {
    await prisma.employee.update({ where: { id: row.employeeId }, data: { shift: remaining[0].team } });
    await prisma.shiftAssignment.delete({ where: { id: remaining[0].id } });
  } else {
    await syncEmployeeShift(organizationId, row.employeeId);
  }
  return row;
}

async function syncEmployeeShift(organizationId: string, employeeId: string) {
  const latest = await prisma.shiftAssignment.findFirst({ where: { organizationId, employeeId }, orderBy: { effectiveFrom: "desc" } });
  if (latest) await prisma.employee.update({ where: { id: employeeId }, data: { shift: latest.team } });
}

/** The team of each guard on a given date, for working out who a swap partner is. */
export async function teamsOnDate(organizationId: string, date: Date) {
  const guards = await listSecurityGuards(organizationId);
  const assignments = await loadAssignments(organizationId, guards.map((g) => g.id));
  return new Map(guards.map((g) => [g.id, teamOn(assignments.get(g.id) ?? [], g.shift, date)]));
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
  const assignmentsByGuard = await loadAssignments(organizationId, guards.map((g) => g.id));
  const today = todayVN();

  const rows = guards.map((guard) => {
    const assignments = assignmentsByGuard.get(guard.id) ?? [];
    const cells: DayCell[] = [];
    // Team changes that take effect inside this month, e.g. B → C from the 15th.
    const teamChanges: { day: number; from: string | null; to: string | null }[] = [];
    let previousTeam = teamOn(assignments, guard.shift, new Date(Date.UTC(year, month - 1, 0)));
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(Date.UTC(year, month - 1, day));
      const key = `${guard.id}|${date.toISOString().slice(0, 10)}`;
      const override = overrideByKey.get(key);
      const team = teamOn(assignments, guard.shift, date);
      if (team !== previousTeam) teamChanges.push({ day, from: previousTeam, to: team });
      previousTeam = team;
      const defaultStatus = computeDefaultStatus(team, date);
      cells.push({
        date,
        status: override?.status ?? defaultStatus,
        defaultStatus,
        isOverride: override !== undefined,
        notes: override?.notes ?? null,
        hours: override?.hours ?? DEFAULT_SHIFT_HOURS,
      });
    }
    const startTeam = teamOn(assignments, guard.shift, new Date(Date.UTC(year, month - 1, 1)));
    return {
      guard,
      cells,
      startTeam,
      teamChanges,
      currentTeam: teamOn(assignments, guard.shift, today),
      history: assignments
        .filter((a) => a.effectiveFrom.getTime() !== BASELINE_DATE.getTime())
        .map((a) => ({ id: a.id, team: a.team, effectiveFrom: a.effectiveFrom.toISOString().slice(0, 10), notes: a.notes })),
    };
  });

  // Group the grid by the team each guard is on at the start of the month.
  rows.sort((a, b) => (a.startTeam ?? "~").localeCompare(b.startTeam ?? "~") || a.guard.fullName.localeCompare(b.guard.fullName, "vi"));

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
