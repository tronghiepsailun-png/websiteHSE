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

export function availableViolationMonths(): { year: number; month: number }[] {
  // Simple rolling window (current month + 11 prior) — cheap and always covers real data
  // without a dedicated "distinct months" query at this data scale.
  const now = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  });
}
