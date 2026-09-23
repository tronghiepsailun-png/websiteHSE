import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/server/errors";

export const EMPLOYEE_STATUSES = ["active", "resigned"] as const;
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

export const EMPLOYEE_PAGE_SIZE = 20;

export type EmployeeLite = { id: string; employeeCode: string; fullName: string; fullNameZh: string | null };

/** Powers employee-picker comboboxes (incident create form, safety-officer roster, ...) —
 *  searches server-side instead of shipping the full ~3000-row employee table to the client. */
export async function searchEmployeesLite(organizationId: string, query: string, limit = 20): Promise<EmployeeLite[]> {
  const q = query.trim();
  if (!q) return [];
  return prisma.employee.findMany({
    where: {
      organizationId,
      status: "active",
      OR: [
        // MSNV is matched by prefix only — typing "538" should never surface an id like
        // "47538" just because the digits appear in the middle. Name search stays
        // contains, since people search by any part of a name.
        { employeeCode: { startsWith: q } },
        { fullName: { contains: q } },
        { fullNameZh: { contains: q } },
      ],
    },
    orderBy: { fullName: "asc" },
    take: limit,
    select: { id: true, employeeCode: true, fullName: true, fullNameZh: true },
  });
}

export type EmployeeFilters = {
  search?: string;
  orgUnitLevel1?: string;
  orgUnitLevel2?: string;
  region?: string;
  team?: string;
  shift?: string;
  position?: string;
  status?: string;
  page?: number;
  /** Bypasses skip/take entirely — powers the list page's "Xem tất cả" toggle. Filtering
   *  (the `where` clause below) is unaffected either way. */
  viewAll?: boolean;
};

export async function listEmployees(organizationId: string, filters: EmployeeFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);

  const where = {
    organizationId,
    orgUnitLevel1: filters.orgUnitLevel1 || undefined,
    orgUnitLevel2: filters.orgUnitLevel2 || undefined,
    region: filters.region || undefined,
    team: filters.team || undefined,
    shift: filters.shift || undefined,
    position: filters.position || undefined,
    status: filters.status || undefined,
    ...(filters.search
      ? {
          OR: [
            { employeeCode: { contains: filters.search } },
            { fullName: { contains: filters.search } },
            { fullNameZh: { contains: filters.search } },
            { nationalId: { contains: filters.search } },
            { orgUnitLevel1: { contains: filters.search } },
            { position: { contains: filters.search } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.employee.findMany({
      where,
      orderBy: { employeeCode: "asc" },
      skip: filters.viewAll ? undefined : (page - 1) * EMPLOYEE_PAGE_SIZE,
      take: filters.viewAll ? undefined : EMPLOYEE_PAGE_SIZE,
    }),
    prisma.employee.count({ where }),
  ]);

  return { items, total, page, pageSize: EMPLOYEE_PAGE_SIZE, totalPages: Math.max(1, Math.ceil(total / EMPLOYEE_PAGE_SIZE)) };
}

export async function getEmployeeById(organizationId: string, id: string) {
  const employee = await prisma.employee.findUnique({ where: { id }, include: { orgUnit: true } });
  if (!employee || employee.organizationId !== organizationId) {
    throw new NotFoundError("Employee not found");
  }
  return employee;
}

/** Drives the employee list page's KPI row and department distribution chart. Department
 *  names are read live from the data (grouped by orgUnitLevel2), never hardcoded, so a
 *  newly-imported department shows up automatically. Active only, throughout — a resigned
 *  employee isn't part of the day-to-day roster this page is for. */
export async function getEmployeeStats(organizationId: string) {
  const [active, byOrgUnitLevel2] = await Promise.all([
    prisma.employee.count({ where: { organizationId, status: "active" } }),
    prisma.employee.groupBy({ by: ["orgUnitLevel2"], where: { organizationId, status: "active" }, _count: { _all: true } }),
  ]);

  const byDepartment = byOrgUnitLevel2
    .filter((g) => g.orgUnitLevel2)
    .map((g) => ({ name: g.orgUnitLevel2 as string, count: g._count._all }))
    .sort((a, b) => b.count - a.count);

  return { active, byDepartment };
}

/** Each dropdown option paired with how many employees currently match it — same idea as an
 *  Excel AutoFilter's per-value counts, so the number is visible before actually picking it. */
export type FacetOption = { value: string; count: number };

type FacetField = "orgUnitLevel1" | "orgUnitLevel2" | "region" | "team" | "shift" | "position";

/** Cascading facet options: each field's option list reflects every OTHER currently-active
 *  filter (so picking a department narrows what regions/shifts/positions show up next), but
 *  never its own filter — otherwise choosing a value would immediately shrink its own dropdown
 *  to a single option. `search`/`status` narrow every facet since they aren't derived options. */
export async function getEmployeeFilterOptions(organizationId: string, filters: EmployeeFilters = {}) {
  const facetWhere = (omit: FacetField) => ({
    organizationId,
    orgUnitLevel1: omit === "orgUnitLevel1" ? undefined : filters.orgUnitLevel1 || undefined,
    orgUnitLevel2: omit === "orgUnitLevel2" ? undefined : filters.orgUnitLevel2 || undefined,
    region: omit === "region" ? undefined : filters.region || undefined,
    team: omit === "team" ? undefined : filters.team || undefined,
    shift: omit === "shift" ? undefined : filters.shift || undefined,
    position: omit === "position" ? undefined : filters.position || undefined,
    status: filters.status || undefined,
    ...(filters.search
      ? {
          OR: [
            { employeeCode: { contains: filters.search } },
            { fullName: { contains: filters.search } },
            { fullNameZh: { contains: filters.search } },
            { nationalId: { contains: filters.search } },
            { orgUnitLevel1: { contains: filters.search } },
            { position: { contains: filters.search } },
          ],
        }
      : {}),
  });

  const countBy = (values: (string | null)[]): FacetOption[] => {
    const counts = new Map<string, number>();
    for (const v of values) {
      if (!v) continue;
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    return [...counts.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => a.value.localeCompare(b.value));
  };

  const [level1, level2, region, team, shift, position] = await Promise.all([
    prisma.employee.findMany({ where: facetWhere("orgUnitLevel1"), select: { orgUnitLevel1: true } }),
    prisma.employee.findMany({ where: facetWhere("orgUnitLevel2"), select: { orgUnitLevel2: true } }),
    prisma.employee.findMany({ where: facetWhere("region"), select: { region: true } }),
    prisma.employee.findMany({ where: facetWhere("team"), select: { team: true } }),
    prisma.employee.findMany({ where: facetWhere("shift"), select: { shift: true } }),
    prisma.employee.findMany({ where: facetWhere("position"), select: { position: true } }),
  ]);

  return {
    orgUnitLevel1: countBy(level1.map((e) => e.orgUnitLevel1)),
    orgUnitLevel2: countBy(level2.map((e) => e.orgUnitLevel2)),
    region: countBy(region.map((e) => e.region)),
    team: countBy(team.map((e) => e.team)),
    shift: countBy(shift.map((e) => e.shift)),
    position: countBy(position.map((e) => e.position)),
  };
}

export type ShiftBreakdown = { shift: string | null; count: number };
export type TeamBreakdown = { team: string | null; count: number; shifts: ShiftBreakdown[] };
export type RegionBreakdown = { region: string | null; count: number; teams: TeamBreakdown[] };
export type Level2Breakdown = { orgUnitLevel2: string | null; count: number; regions: RegionBreakdown[] };
export type Level1Breakdown = { orgUnitLevel1: string | null; count: number; level2: Level2Breakdown[] };

function groupBy<T, K>(items: T[], keyFn: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const bucket = map.get(key);
    if (bucket) bucket.push(item);
    else map.set(key, [item]);
  }
  return map;
}

function sortByCountDesc<T extends { count: number }>(items: T[]): T[] {
  return items.sort((a, b) => b.count - a.count);
}

// Khu vực (region) values encode a factory phase (一期/二期/三期/...) as a substring — sorting by
// headcount instead of phase number made this list read in a visually random order. Extracted
// rank puts recognized phases first in numeric order; anything else falls back after them,
// by headcount, same as before.
const PHASE_MARKERS = ["一期", "二期", "三期", "四期", "五期"];
function phaseRank(region: string | null): number {
  if (!region) return PHASE_MARKERS.length + 1;
  const idx = PHASE_MARKERS.findIndex((marker) => region.includes(marker));
  return idx === -1 ? PHASE_MARKERS.length : idx;
}
function sortRegionsByPhase<T extends { region: string | null; count: number }>(items: T[]): T[] {
  return items.sort((a, b) => phaseRank(a.region) - phaseRank(b.region) || b.count - a.count);
}

// Ca (shift) values are the rotating team letter (A/B/C — see attendance.ts's TEAM_ROTATION)
// for most employees, and some other raw string (e.g. a fixed day-shift label) for the rest —
// sorting those by headcount interleaved them with A/B/C unpredictably. A/B/C now always sort
// first in that order; every other value (including "unspecified") follows, by headcount.
const SHIFT_ORDER = ["A", "B", "C"];
function shiftRank(shift: string | null): number {
  if (!shift) return SHIFT_ORDER.length + 1;
  const idx = SHIFT_ORDER.indexOf(shift.trim().toUpperCase());
  return idx === -1 ? SHIFT_ORDER.length : idx;
}
function sortShiftsByTeam<T extends { shift: string | null; count: number }>(items: T[]): T[] {
  return items.sort((a, b) => shiftRank(a.shift) - shiftRank(b.shift) || b.count - a.count);
}

type HierarchyRow = { orgUnitLevel1: string | null; orgUnitLevel2: string | null; region: string | null; team: string | null; shift: string | null };

/** Full Bộ phận cấp 1 → cấp 2 → Khu vực → Tổ nhóm → Ca hierarchy with headcounts at every
 *  level — powers the "Xem chi tiết" drill-down dialog on the department distribution chart.
 *  Missing values at any level stay `null` (not resolved to a display label) so the client
 *  can localize "Không xác định"/"未指定" itself. */
export async function getEmployeeHierarchy(organizationId: string): Promise<Level1Breakdown[]> {
  // Active only — same reasoning as getEmployeeStats' byDepartment: this counts who's actually
  // on the floor today, not every historical record (a resigned employee still keeps their old
  // department/shift data, so without this filter they'd keep padding out headcounts here
  // indefinitely after leaving).
  const rows: HierarchyRow[] = await prisma.employee.findMany({
    where: { organizationId, status: "active" },
    select: { orgUnitLevel1: true, orgUnitLevel2: true, region: true, team: true, shift: true },
  });

  const byLevel1 = groupBy(rows, (r) => r.orgUnitLevel1);
  const level1 = [...byLevel1.entries()].map(([orgUnitLevel1, l1Rows]): Level1Breakdown => {
    const byLevel2 = groupBy(l1Rows, (r) => r.orgUnitLevel2);
    const level2 = [...byLevel2.entries()].map(([orgUnitLevel2, l2Rows]): Level2Breakdown => {
      const byRegion = groupBy(l2Rows, (r) => r.region);
      const regions = [...byRegion.entries()].map(([region, rgRows]): RegionBreakdown => {
        const byTeam = groupBy(rgRows, (r) => r.team);
        const teams = [...byTeam.entries()].map(([team, tmRows]): TeamBreakdown => {
          const byShift = groupBy(tmRows, (r) => r.shift);
          const shifts = [...byShift.entries()].map(([shift, shRows]): ShiftBreakdown => ({ shift, count: shRows.length }));
          return { team, count: tmRows.length, shifts: sortShiftsByTeam(shifts) };
        });
        return { region, count: rgRows.length, teams: sortByCountDesc(teams) };
      });
      return { orgUnitLevel2, count: l2Rows.length, regions: sortRegionsByPhase(regions) };
    });
    return { orgUnitLevel1, count: l1Rows.length, level2: sortByCountDesc(level2) };
  });

  return sortByCountDesc(level1);
}
