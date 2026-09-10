/**
 * One-time data fix: populates the new OrgUnit.nameVi / IncidentCategory.nameVi columns so the
 * Incidents module's "Bộ phận" and "Danh mục" columns can display in Vietnamese, matching the
 * existing severity/status behavior. For the 8 department names that also exist in the
 * SafetyWorkshop quick-pick catalog, reuses that catalog's own (user-confirmed) Vietnamese name
 * verbatim for consistency. The other department names are best-effort AI translations
 * following the exact same naming convention already used in SafetyWorkshop (一期/二期/三期 →
 * "Giai đoạn 1/2/3", 车间 → "Xưởng ...", etc.) — the user has explicitly said these are
 * provisional and will review/correct them, so this script is safe to re-run if names change.
 * Run: npx tsx scripts/seed-org-unit-and-category-name-vi.ts
 */
import { prisma } from "../src/lib/prisma";

const ORG_NAME = "CCG";

const CATEGORY_NAME_VI: Record<string, string> = {
  "其他事故": "Sự cố khác",
  "化学品/灼伤事故": "Hóa chất/Bỏng",
  "叉车/车辆事故": "Xe nâng/Xe cộ",
  "尖锐物/工具伤害": "Vật sắc nhọn/Dụng cụ",
  "机械/设备事故": "Máy móc/Thiết bị",
  "火灾/爆炸事故": "Cháy nổ",
  "电气/触电事故": "Điện/Giật điện",
  "跌倒/碰撞事故": "Té ngã/Va chạm",
};

// Departments that already have a confirmed Vietnamese name in the SafetyWorkshop catalog are
// intentionally left out here — the script pulls those live instead of duplicating them.
const ORG_UNIT_NAME_VI: Record<string, string> = {
  "一期仓储科": "Kho vận Giai đoạn 1",
  "一期原料": "Nguyên liệu Giai đoạn 1",
  "一期拉丝": "Kéo sợi Giai đoạn 1",
  "一期曲丝": "Sợi Xoắn Giai đoạn 1",
  "一期直丝": "Sợi thẳng Giai đoạn 1",
  "一期簇绒": "Dệt Thảm Giai đoạn 1",
  "一期背胶": "Phủ keo Giai đoạn 1",
  "一期草丝": "Sợi cỏ Giai đoạn 1",
  "一期草坪": "Sân cỏ Giai đoạn 1",
  "一期设备部": "Bộ Phận Thiết Bị Giai đoạn 1",
  "一期超市草": "Cỏ siêu thị Giai đoạn 1",
  "三期曲丝": "Sợi Xoắn Giai đoạn 3",
  "三期簇绒": "Dệt Thảm Giai đoạn 3",
  "三期超市草": "Cỏ siêu thị Giai đoạn 3",
  "业务部": "Bộ Phận Kinh Doanh",
  "二期仓储科": "Kho vận Giai đoạn 2",
  "二期原料": "Nguyên liệu Giai đoạn 2",
  "二期原料车间": "Xưởng Nguyên Liệu Giai đoạn 2",
  "二期拉丝": "Kéo sợi Giai đoạn 2",
  "二期曲丝": "Sợi Xoắn Giai đoạn 2",
  "二期直丝": "Sợi thẳng Giai đoạn 2",
  "二期簇绒": "Dệt Thảm Giai đoạn 2",
  "二期背胶": "Phủ keo Giai đoạn 2",
  "二期草丝": "Sợi cỏ Giai đoạn 2",
  "二期草坪": "Sân cỏ Giai đoạn 2",
  "二期设备部": "Bộ Phận Thiết Bị Giai đoạn 2",
  "二期质保": "Chất lượng Giai đoạn 2",
  "二期超市草": "Cỏ siêu thị Giai đoạn 2",
  "生产一部": "Bộ Phận Sản Xuất 1",
  "生产二部": "Bộ Phận Sản Xuất 2",
  "综合管理部": "Bộ Phận Quản Lý Tổng Hợp",
  "计划部": "Bộ Phận Kế Hoạch",
  "财务部": "Bộ Phận Tài Chính",
  "质量部": "Bộ Phận Chất Lượng",
  "超市草车间": "Xưởng cỏ siêu thị",
  "采购科": "Phòng Mua Hàng",
};

async function main() {
  const org = await prisma.organization.findFirstOrThrow({ where: { name: ORG_NAME } });

  let categoryCount = 0;
  for (const [name, nameVi] of Object.entries(CATEGORY_NAME_VI)) {
    const result = await prisma.incidentCategory.updateMany({ where: { organizationId: org.id, name }, data: { nameVi } });
    categoryCount += result.count;
  }
  console.log(`Updated ${categoryCount} IncidentCategory rows.`);

  const workshops = await prisma.safetyWorkshop.findMany({ where: { organizationId: org.id }, select: { name: true, nameVi: true } });
  let orgUnitCount = 0;
  for (const w of workshops) {
    if (!w.nameVi) continue;
    const result = await prisma.orgUnit.updateMany({ where: { organizationId: org.id, name: w.name }, data: { nameVi: w.nameVi } });
    orgUnitCount += result.count;
  }
  for (const [name, nameVi] of Object.entries(ORG_UNIT_NAME_VI)) {
    const result = await prisma.orgUnit.updateMany({ where: { organizationId: org.id, name }, data: { nameVi } });
    orgUnitCount += result.count;
  }
  console.log(`Updated ${orgUnitCount} OrgUnit rows.`);

  const stillMissing = await prisma.orgUnit.findMany({ where: { organizationId: org.id, nameVi: null }, select: { name: true, unitType: { select: { code: true } } } });
  if (stillMissing.length > 0) {
    console.log("OrgUnits still missing nameVi:", stillMissing);
  }
}

main().finally(() => prisma.$disconnect());
