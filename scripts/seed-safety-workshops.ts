import { prisma } from "../src/lib/prisma";

// Canonical ~20-workshop catalog, matching sheet "04.部门安全扣分" column B exactly
// (sortOrder = report row order). groupName matches that sheet's column A.
const WORKSHOPS: { code: string; name: string; groupName: string; sortOrder: number; safetyCategory: string }[] = [
  { code: "straight-yarn-1", name: "一期直丝车间", groupName: "生产一部", sortOrder: 1, safetyCategory: "1类" },
  { code: "straight-yarn-2", name: "二期直丝车间", groupName: "生产一部", sortOrder: 2, safetyCategory: "1类" },
  { code: "curled-yarn-1", name: "一期曲丝车间", groupName: "生产一部", sortOrder: 3, safetyCategory: "1类" },
  { code: "curled-yarn-2", name: "二期曲丝车间", groupName: "生产一部", sortOrder: 4, safetyCategory: "1类" },
  { code: "curled-yarn-3", name: "三期曲丝车间", groupName: "生产一部", sortOrder: 5, safetyCategory: "1类" },
  { code: "backing-fabric-3", name: "三期底布", groupName: "生产一部", sortOrder: 6, safetyCategory: "1类" },
  { code: "paper-tube-3", name: "三期纸管", groupName: "生产一部", sortOrder: 7, safetyCategory: "1类" },
  { code: "raw-material", name: "原料车间", groupName: "生产二部", sortOrder: 8, safetyCategory: "1类" },
  { code: "tufting-1", name: "一期簇绒车间", groupName: "生产二部", sortOrder: 9, safetyCategory: "1类" },
  { code: "tufting-2", name: "二期簇绒车间", groupName: "生产二部", sortOrder: 10, safetyCategory: "1类" },
  { code: "tufting-3", name: "三期簇绒车间", groupName: "生产二部", sortOrder: 11, safetyCategory: "1类" },
  { code: "backing-glue-1", name: "一期背胶车间", groupName: "生产二部", sortOrder: 12, safetyCategory: "1类" },
  { code: "backing-glue-2", name: "二期背胶车间", groupName: "生产二部", sortOrder: 13, safetyCategory: "1类" },
  { code: "supermarket-turf-3", name: "三期超市草车间", groupName: "生产二部", sortOrder: 14, safetyCategory: "1类" },
  { code: "planning", name: "计划科", groupName: "计划部", sortOrder: 15, safetyCategory: "2类" },
  { code: "warehouse", name: "仓储科", groupName: "计划部", sortOrder: 16, safetyCategory: "1类" },
  { code: "equipment", name: "设备部", groupName: "设备部", sortOrder: 17, safetyCategory: "1类" },
  { code: "process", name: "工艺部", groupName: "工艺部", sortOrder: 18, safetyCategory: "2类" },
  { code: "qa", name: "质保部", groupName: "质保部", sortOrder: 19, safetyCategory: "2类" },
  { code: "admin", name: "行政科", groupName: "行政科", sortOrder: 20, safetyCategory: "2类" },
  // Sheet "02.部门事件统计" has this 21st column ("废气物资/Lò hơi" — boiler/exhaust-gas) that
  // sheet "04.部门安全扣分" does NOT track as a row — kept out of sheets 03/04's workshop list
  // (see the `code !== "boiler"` filters in incident-reports.ts) but still a real SafetyWorkshop
  // so /admin/hse-targets can map a department name onto it if this area ever logs an incident.
  { code: "boiler", name: "废气物资", groupName: "其他", sortOrder: 21, safetyCategory: "2类" },
];

// raw departmentSnapshot -> workshop code. "null" (JS null value) -> unclassified (no alias row needed,
// resolver treats missing lookup as unclassified too, but we still seed it for clarity/admin visibility).
const ALIASES: { rawText: string; workshopCode: string | null }[] = [
  { rawText: "一期草丝", workshopCode: "straight-yarn-1" },
  { rawText: "一期拉丝", workshopCode: "straight-yarn-1" },
  { rawText: "一期直丝", workshopCode: "straight-yarn-1" },
  { rawText: "二期草丝", workshopCode: "straight-yarn-2" },
  { rawText: "二期拉丝", workshopCode: "straight-yarn-2" },
  { rawText: "二期直丝", workshopCode: "straight-yarn-2" },
  { rawText: "一期曲丝", workshopCode: "curled-yarn-1" },
  { rawText: "二期曲丝", workshopCode: "curled-yarn-2" },
  { rawText: "三期曲丝", workshopCode: "curled-yarn-3" },
  { rawText: "三期底布", workshopCode: "backing-fabric-3" },
  { rawText: "三期纸管", workshopCode: "paper-tube-3" },
  { rawText: "原料车间", workshopCode: "raw-material" },
  { rawText: "一期原料", workshopCode: "raw-material" },
  { rawText: "二期原料", workshopCode: "raw-material" },
  { rawText: "二期原料车间", workshopCode: "raw-material" },
  { rawText: "一期簇绒", workshopCode: "tufting-1" },
  { rawText: "二期簇绒", workshopCode: "tufting-2" },
  { rawText: "三期簇绒", workshopCode: "tufting-3" },
  { rawText: "一期背胶", workshopCode: "backing-glue-1" },
  { rawText: "二期背胶", workshopCode: "backing-glue-2" },
  { rawText: "一期超市草", workshopCode: "supermarket-turf-3" },
  { rawText: "二期超市草", workshopCode: "supermarket-turf-3" },
  { rawText: "三期超市草", workshopCode: "supermarket-turf-3" },
  { rawText: "超市草车间", workshopCode: "supermarket-turf-3" },
  { rawText: "计划科", workshopCode: "planning" },
  { rawText: "仓储科", workshopCode: "warehouse" },
  { rawText: "一期仓储科", workshopCode: "warehouse" },
  { rawText: "二期仓储科", workshopCode: "warehouse" },
  { rawText: "设备部", workshopCode: "equipment" },
  { rawText: "一期设备部", workshopCode: "equipment" },
  { rawText: "二期设备部", workshopCode: "equipment" },
  { rawText: "工艺部", workshopCode: "process" },
  { rawText: "质保部", workshopCode: "qa" },
  { rawText: "二期质保", workshopCode: "qa" },
  { rawText: "行政科", workshopCode: "admin" },
  // No confident canonical bucket (per user: 2026 data doesn't use these; leave unclassified)
  { rawText: "一期草坪", workshopCode: null },
  { rawText: "二期草坪", workshopCode: null },
];

async function main() {
  const orgs = await prisma.organization.findMany({
    where: { incidents: { some: {} } },
    select: { id: true, name: true },
  });

  for (const org of orgs) {
    console.log(`Seeding SafetyWorkshop/DepartmentAlias for org ${org.name} (${org.id})`);

    const workshopIdByCode = new Map<string, string>();
    for (const w of WORKSHOPS) {
      const row = await prisma.safetyWorkshop.upsert({
        where: { organizationId_code: { organizationId: org.id, code: w.code } },
        update: { name: w.name, groupName: w.groupName, sortOrder: w.sortOrder, safetyCategory: w.safetyCategory },
        create: { organizationId: org.id, ...w },
      });
      workshopIdByCode.set(w.code, row.id);
    }

    for (const a of ALIASES) {
      const safetyWorkshopId = a.workshopCode ? workshopIdByCode.get(a.workshopCode)! : null;
      await prisma.departmentAlias.upsert({
        where: { organizationId_rawText: { organizationId: org.id, rawText: a.rawText } },
        update: { safetyWorkshopId },
        create: { organizationId: org.id, rawText: a.rawText, safetyWorkshopId },
      });
    }

    // Also seed an explicit "" (null-department) unclassified alias row for visibility in the admin UI.
    await prisma.departmentAlias.upsert({
      where: { organizationId_rawText: { organizationId: org.id, rawText: "" } },
      update: {},
      create: { organizationId: org.id, rawText: "", safetyWorkshopId: null },
    });

    console.log(`  -> ${WORKSHOPS.length} workshops, ${ALIASES.length + 1} aliases`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
