import { prisma } from "../src/lib/prisma";

// Factory-wide (safetyWorkshopId = null) sheet-05 targets, copied verbatim from the reference
// report "Danh sách sự cố và khảo hạch.xlsx" sheet "05.工厂年度HSE目标", 2026年目标 column.
const TARGETS_2026: Record<string, number> = {
  kpi_safety_deduction_total_target: 2.4,
  kpi_e_level_incidents_target: 0,
  kpi_acute_poisoning_target: 0,
  kpi_occupational_disease_target: 0,
  kpi_major_fire_target: 0,
  kpi_hazard_rectification_rate_target: 0.9, // displayed as "≥90%" (see KPI_ITEMS.targetDisplayPrefix)
  kpi_training_participation_rate_target: 1,
  kpi_major_env_pollution_target: 0,
  kpi_major_env_complaints_target: 0,
  kpi_env_complaint_resolution_rate_target: 1,
};

// The 3 "rate" KPIs have no dedicated tracked data source in this app, so their monthly
// actual is whatever HSE staff enters via /admin/hse-targets. The reference file shows 100%
// every month in both 2025 (full year) and 2026 (Jan-Jul so far) — seed that as the starting
// baseline; an admin can override a specific month later if a real shortfall occurs.
const RATE_KPI_CODES = ["hazard_rectification_rate", "training_participation_rate", "env_complaint_resolution_rate"];

async function main() {
  const orgs = await prisma.organization.findMany({
    where: { incidents: { some: {} } },
    select: { id: true, name: true },
  });

  for (const org of orgs) {
    console.log(`Seeding HseYearlyTarget for org ${org.name} (${org.id})`);

    for (const [metricKey, value] of Object.entries(TARGETS_2026)) {
      await upsertTarget(org.id, 2026, metricKey, value);
    }

    for (const code of RATE_KPI_CODES) {
      for (let m = 1; m <= 12; m++) {
        const key = `kpi_${code}_m${String(m).padStart(2, "0")}`;
        await upsertTarget(org.id, 2025, key, 1);
        await upsertTarget(org.id, 2026, key, 1);
      }
    }
  }
}

async function upsertTarget(organizationId: string, year: number, metricKey: string, value: number) {
  const existing = await prisma.hseYearlyTarget.findFirst({
    where: { organizationId, safetyWorkshopId: null, year, metricKey },
  });
  if (existing) {
    await prisma.hseYearlyTarget.update({ where: { id: existing.id }, data: { value } });
  } else {
    await prisma.hseYearlyTarget.create({ data: { organizationId, safetyWorkshopId: null, year, metricKey, value } });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
