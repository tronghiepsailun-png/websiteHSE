import { prisma } from "@/lib/prisma";

export async function listSafetyOfficers(organizationId: string) {
  return prisma.safetyOfficer.findMany({
    where: { organizationId, isActive: true },
    include: { employee: true },
    orderBy: { sortOrder: "asc" },
  });
}

export async function listViolationTypes(organizationId: string) {
  return prisma.violationType.findMany({
    where: { organizationId, isActive: true },
    orderBy: { sortOrder: "asc" },
  });
}

export type ViolationFilters = {
  year: number;
  month: number;
};

function monthRange(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return { start, end };
}

export async function listViolations(organizationId: string, filters: ViolationFilters) {
  const { start, end } = monthRange(filters.year, filters.month);
  return prisma.safetyViolation.findMany({
    where: { organizationId, occurredAt: { gte: start, lt: end } },
    include: { safetyOfficer: { include: { employee: true } }, violationType: true },
    orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }],
  });
}

/** Mirrors the source spreadsheet's "02.安全员补贴明细" sheet: each active officer's fixed
 *  monthly subsidy, minus the sum of that month's violation deductions, equals net subsidy. */
export async function getSubsidyReport(organizationId: string, filters: ViolationFilters) {
  const [officers, violations] = await Promise.all([
    listSafetyOfficers(organizationId),
    listViolations(organizationId, filters),
  ]);

  const deductionByOfficer = new Map<string, number>();
  for (const v of violations) {
    deductionByOfficer.set(v.safetyOfficerId, (deductionByOfficer.get(v.safetyOfficerId) ?? 0) + v.amountVnd);
  }

  const rows = officers.map((o) => {
    const deduction = deductionByOfficer.get(o.id) ?? 0;
    return {
      safetyOfficer: o,
      baseAmountVnd: o.monthlySubsidyVnd,
      deductionVnd: deduction,
      netAmountVnd: o.monthlySubsidyVnd - deduction,
    };
  });

  return {
    rows,
    totalBaseVnd: rows.reduce((s, r) => s + r.baseAmountVnd, 0),
    totalDeductionVnd: rows.reduce((s, r) => s + r.deductionVnd, 0),
    totalNetVnd: rows.reduce((s, r) => s + r.netAmountVnd, 0),
  };
}

/** Only the months that actually have a violation logged — unlike a fixed rolling window,
 *  this never shows an empty past month with nothing to view. The current month always stays
 *  in the list even with zero violations yet, since that's where new ones get added. SQLite
 *  has no clean "group by extracted year/month" in Prisma's query API, and this data stays
 *  small at this org's scale, so distinct periods are computed in JS from the raw dates. */
export async function availableViolationMonths(organizationId: string): Promise<{ year: number; month: number }[]> {
  const rows = await prisma.safetyViolation.findMany({ where: { organizationId }, select: { occurredAt: true } });

  const now = new Date();
  const periods = new Map<string, { year: number; month: number }>();
  for (const row of rows) {
    const year = row.occurredAt.getFullYear();
    const month = row.occurredAt.getMonth() + 1;
    periods.set(`${year}-${month}`, { year, month });
  }
  periods.set(`${now.getFullYear()}-${now.getMonth() + 1}`, { year: now.getFullYear(), month: now.getMonth() + 1 });

  return Array.from(periods.values()).sort((a, b) => b.year - a.year || b.month - a.month);
}
