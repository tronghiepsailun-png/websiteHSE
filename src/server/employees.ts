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

/** Distinct, non-empty values for each filter dropdown — same idea as the incident dashboard's availableYears/orgUnits. */
export async function getEmployeeFilterOptions(organizationId: string) {
  const employees = await prisma.employee.findMany({
    where: { organizationId },
    select: { orgUnitLevel1: true, orgUnitLevel2: true, region: true, shift: true, position: true },
  });

  const distinct = (values: (string | null)[]) => [...new Set(values.filter((v): v is string => Boolean(v)))].sort();

  return {
    orgUnitLevel1: distinct(employees.map((e) => e.orgUnitLevel1)),
    orgUnitLevel2: distinct(employees.map((e) => e.orgUnitLevel2)),
    region: distinct(employees.map((e) => e.region)),
    shift: distinct(employees.map((e) => e.shift)),
    position: distinct(employees.map((e) => e.position)),
  };
}
