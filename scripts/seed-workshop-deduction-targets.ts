import { prisma } from "../src/lib/prisma";
import { HSE_TARGET_METRIC } from "../src/server/incident-reports";

// D/E/F columns of sheet "04.部门安全扣分" in the reference report, copied verbatim.
// D = 2025年实际扣分 (prior year actual), E = 2025年目标扣分 (prior year target),
// F = 2026年目标扣分 (current year target). Rows with no value in the source (curled-yarn-3,
// tufting-3) are omitted — nothing to seed there, matching the original file's own blank cells.
const WORKSHOP_TARGETS: { code: string; actualPrior: number; targetPrior: number; targetCurrent: number }[] = [
  { code: "straight-yarn-1", actualPrior: 0, targetPrior: 0.1, targetCurrent: 0.1 },
  { code: "straight-yarn-2", actualPrior: 0.2, targetPrior: 0.1, targetCurrent: 0.1 },
  { code: "curled-yarn-1", actualPrior: 0.2, targetPrior: 0.1, targetCurrent: 0.1 },
  { code: "curled-yarn-2", actualPrior: 0, targetPrior: 0.1, targetCurrent: 0.1 },
  { code: "backing-fabric-3", actualPrior: 0.1, targetPrior: 0.1, targetCurrent: 0.1 },
  { code: "paper-tube-3", actualPrior: 0, targetPrior: 0.1, targetCurrent: 0.1 },
  { code: "raw-material", actualPrior: 0.34, targetPrior: 0.4, targetCurrent: 0.4 },
  { code: "tufting-1", actualPrior: 0.1, targetPrior: 0.1, targetCurrent: 0.1 },
  { code: "tufting-2", actualPrior: 0, targetPrior: 0.1, targetCurrent: 0.1 },
  { code: "backing-glue-1", actualPrior: 0.2, targetPrior: 0.3, targetCurrent: 0.3 },
  { code: "backing-glue-2", actualPrior: 0.4, targetPrior: 0.3, targetCurrent: 0.3 },
  { code: "supermarket-turf-3", actualPrior: 0.9, targetPrior: 0.1, targetCurrent: 0.1 },
  { code: "planning", actualPrior: 0, targetPrior: 0, targetCurrent: 0 },
  { code: "warehouse", actualPrior: 0.16, targetPrior: 0.4, targetCurrent: 0.4 },
  { code: "equipment", actualPrior: 0.4, targetPrior: 0.1, targetCurrent: 0.1 },
  { code: "process", actualPrior: 0, targetPrior: 0, targetCurrent: 0 },
  { code: "qa", actualPrior: 0, targetPrior: 0, targetCurrent: 0 },
  { code: "admin", actualPrior: 0, targetPrior: 0, targetCurrent: 0 },
];

const CURRENT_YEAR = 2026;

async function upsertTarget(organizationId: string, safetyWorkshopId: string, year: number, metricKey: string, value: number) {
  const existing = await prisma.hseYearlyTarget.findFirst({ where: { organizationId, safetyWorkshopId, year, metricKey } });
  if (existing) {
    await prisma.hseYearlyTarget.update({ where: { id: existing.id }, data: { value } });
  } else {
    await prisma.hseYearlyTarget.create({ data: { organizationId, safetyWorkshopId, year, metricKey, value } });
  }
}

async function main() {
  const orgs = await prisma.organization.findMany({ where: { incidents: { some: {} } }, select: { id: true, name: true } });

  for (const org of orgs) {
    console.log(`Seeding workshop deduction targets for org ${org.name} (${org.id})`);
    const workshops = await prisma.safetyWorkshop.findMany({ where: { organizationId: org.id } });
    const workshopByCode = new Map(workshops.map((w) => [w.code, w]));

    for (const t of WORKSHOP_TARGETS) {
      const workshop = workshopByCode.get(t.code);
      if (!workshop) {
        console.warn(`  ! no workshop found for code ${t.code}, skipping`);
        continue;
      }
      await upsertTarget(org.id, workshop.id, CURRENT_YEAR - 1, HSE_TARGET_METRIC.deductionActual, t.actualPrior);
      await upsertTarget(org.id, workshop.id, CURRENT_YEAR - 1, HSE_TARGET_METRIC.deductionTarget, t.targetPrior);
      await upsertTarget(org.id, workshop.id, CURRENT_YEAR, HSE_TARGET_METRIC.deductionTarget, t.targetCurrent);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
