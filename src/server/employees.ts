import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/server/errors";

export const EMPLOYEE_STATUSES = ["active", "resigned"] as const;
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

export const EMPLOYEE_PAGE_SIZE = 20;

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
 *  newly-imported department shows up automatically. */
export async function getEmployeeStats(organizationId: string) {
  const [total, active, byOrgUnitLevel2] = await Promise.all([
    prisma.employee.count({ where: { organizationId } }),
    prisma.employee.count({ where: { organizationId, status: "active" } }),
    prisma.employee.groupBy({ by: ["orgUnitLevel2"], where: { organizationId }, _count: { _all: true } }),
  ]);

  const byDepartment = byOrgUnitLevel2
    .filter((g) => g.orgUnitLevel2)
    .map((g) => ({ name: g.orgUnitLevel2 as string, count: g._count._all }))
    .sort((a, b) => b.count - a.count);

  return { total, active, resigned: total - active, byDepartment };
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
