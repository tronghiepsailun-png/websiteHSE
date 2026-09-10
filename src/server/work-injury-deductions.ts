import { prisma } from "@/lib/prisma";

/** Only the months that actually have a deduction list — unlike a fixed rolling window, this
 *  never shows an empty past month with no data to view. The current month always stays in
 *  the list even with zero rows yet, since that's where "Thêm mục" adds new ones. */
export async function availableWorkInjuryDeductionMonths(organizationId: string): Promise<{ year: number; month: number }[]> {
  const rows = await prisma.workInjuryDeduction.findMany({
    where: { organizationId },
    select: { periodYear: true, periodMonth: true },
    distinct: ["periodYear", "periodMonth"],
  });

  const now = new Date();
  const periods = new Map(rows.map((r) => [`${r.periodYear}-${r.periodMonth}`, { year: r.periodYear, month: r.periodMonth }]));
  periods.set(`${now.getFullYear()}-${now.getMonth() + 1}`, { year: now.getFullYear(), month: now.getMonth() + 1 });

  return Array.from(periods.values()).sort((a, b) => (b.year - a.year) || (b.month - a.month));
}

export async function listWorkInjuryDeductions(
  organizationId: string,
  filters: { year: number; month: number; search?: string }
) {
  return prisma.workInjuryDeduction.findMany({
    where: {
      organizationId,
      periodYear: filters.year,
      periodMonth: filters.month,
      ...(filters.search
        ? {
            OR: [
              { employeeCodeSnapshot: { contains: filters.search } },
              { fullNameZhSnapshot: { contains: filters.search } },
              { fullNameViSnapshot: { contains: filters.search } },
              { orgUnitLevel1Snapshot: { contains: filters.search } },
              { orgUnitLevel2Snapshot: { contains: filters.search } },
            ],
          }
        : {}),
    },
    orderBy: [{ accidentDate: "asc" }, { createdAt: "asc" }],
  });
}

export async function getWorkInjuryDeductionSummary(organizationId: string, filters: { year: number; month: number }) {
  const [count, agg] = await Promise.all([
    prisma.workInjuryDeduction.count({ where: { organizationId, periodYear: filters.year, periodMonth: filters.month } }),
    prisma.workInjuryDeduction.aggregate({
      where: { organizationId, periodYear: filters.year, periodMonth: filters.month },
      _sum: { fineAmountVnd: true },
    }),
  ]);
  return { count, totalFineVnd: agg._sum.fineAmountVnd ?? 0 };
}
