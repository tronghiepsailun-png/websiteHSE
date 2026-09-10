// Vietnamese display names for the SafetyWorkshop catalog (name itself stays Chinese —
// the canonical form the incident-report module was built around). Matched by `code`,
// which is stable and shared across every organization the catalog was seeded into.
import { prisma } from "../src/lib/prisma";

const NAME_VI: Record<string, string> = {
  "straight-yarn-1": "Xưởng Sợi thẳng Giai đoạn 1",
  "straight-yarn-2": "Xưởng Sợi thẳng Giai đoạn 2",
  // User-supplied list had "Giai đoạn 3" here (matches curled-yarn-3 verbatim) — corrected to
  // 1 to match this group's otherwise consistent 1/2/3 sequence; flagged back to the user.
  "curled-yarn-1": "Xưởng Sợi Xoắn Giai đoạn 1",
  "curled-yarn-2": "Xưởng Sợi Xoắn Giai đoạn 2",
  "curled-yarn-3": "Xưởng Sợi Xoắn Giai đoạn 3",
  // "vãi" → "vải" (fabric) — corrected an evident typo.
  "backing-fabric-3": "Xưởng vải nền Giai đoạn 3",
  "paper-tube-3": "Xưởng ống giấy Giai đoạn 3",
  "raw-material": "Xưởng Nguyên Liệu",
  "tufting-1": "Xưởng Dệt Thảm Giai đoạn 1",
  "tufting-2": "Xưởng Dệt Thảm Giai đoạn 2",
  "tufting-3": "Xưởng Dệt Thảm Giai đoạn 3",
  "backing-glue-1": "Xưởng Phủ keo Giai đoạn 1",
  "backing-glue-2": "Xưởng Phủ keo Giai đoạn 2",
  "supermarket-turf-3": "Xưởng cỏ siêu thị Giai đoạn 3",
  planning: "Phòng Kế Hoạch",
  warehouse: "Bộ Phận Kho Vận",
  equipment: "Bộ Phận Thiết Bị",
  process: "Bộ Phận Kỹ Thuật",
  qa: "Bộ Phận Chất Lượng",
  admin: "Phòng Hành Chính",
  boiler: "Phế Liệu",
};

async function main() {
  let count = 0;
  for (const [code, nameVi] of Object.entries(NAME_VI)) {
    const { count: updated } = await prisma.safetyWorkshop.updateMany({ where: { code }, data: { nameVi } });
    count += updated;
  }
  console.log(`Updated nameVi on ${count} safety workshop rows`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
