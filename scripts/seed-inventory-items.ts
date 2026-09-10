// Seeds the 15-item PCCC equipment catalog (with real product photos in public/inventory)
// into every existing organization. Upsert-based on [organizationId, name] so this is safe
// to re-run after editing the list below.
import { prisma } from "../src/lib/prisma";

const ITEMS: { name: string; unit: string; imageUrl: string; minStockLevel: number; sortOrder: number }[] = [
  { name: "Tủ chữa cháy trong nhà", unit: "Cái", imageUrl: "/inventory/tu-chua-chay-trong.png", minStockLevel: 2, sortOrder: 0 },
  { name: "Tủ chữa cháy ngoài trời", unit: "Cái", imageUrl: "/inventory/tu-chua-chay-ngoai.png", minStockLevel: 2, sortOrder: 1 },
  { name: "Gương cầu lồi", unit: "Cái", imageUrl: "/inventory/guong-kinh-loi.png", minStockLevel: 3, sortOrder: 2 },
  { name: "Đèn bắt côn trùng", unit: "Cái", imageUrl: "/inventory/den-bat-con-trung.png", minStockLevel: 3, sortOrder: 3 },
  { name: "Lăng chữa cháy D50", unit: "Cái", imageUrl: "/inventory/lang-chua-chay-d50.png", minStockLevel: 5, sortOrder: 4 },
  { name: "Lăng chữa cháy D65", unit: "Cái", imageUrl: "/inventory/lang-chua-chay-d65.png", minStockLevel: 5, sortOrder: 5 },
  { name: "Dây chữa cháy D50", unit: "Cuộn", imageUrl: "/inventory/day-chua-chay-d50.png", minStockLevel: 5, sortOrder: 6 },
  { name: "Dây chữa cháy D65", unit: "Cuộn", imageUrl: "/inventory/day-chua-chay-d65.png", minStockLevel: 5, sortOrder: 7 },
  { name: "Chuông báo cháy", unit: "Cái", imageUrl: "/inventory/chuong-bao-chay.png", minStockLevel: 5, sortOrder: 8 },
  { name: "Nút nhấn báo cháy", unit: "Cái", imageUrl: "/inventory/nut-nhan.png", minStockLevel: 5, sortOrder: 9 },
  { name: "Đèn tín hiệu", unit: "Cái", imageUrl: "/inventory/den-tin-hieu.png", minStockLevel: 3, sortOrder: 10 },
  { name: "Bảng tiêu lệnh PCCC", unit: "Tấm", imageUrl: "/inventory/bang-noi-quy-tieu-lenh.png", minStockLevel: 3, sortOrder: 11 },
  { name: "Đồng phục PCCC", unit: "Bộ", imageUrl: "/inventory/dong-phuc.png", minStockLevel: 10, sortOrder: 12 },
  { name: "Mũ PCCC", unit: "Cái", imageUrl: "/inventory/mu-pccc.png", minStockLevel: 10, sortOrder: 13 },
  { name: "Ủng PCCC", unit: "Đôi", imageUrl: "/inventory/ung-pccc.png", minStockLevel: 10, sortOrder: 14 },
];

async function main() {
  const orgs = await prisma.organization.findMany({ select: { id: true, name: true } });
  let count = 0;
  for (const org of orgs) {
    for (const item of ITEMS) {
      const existing = await prisma.inventoryItem.findFirst({ where: { organizationId: org.id, name: item.name } });
      if (existing) {
        await prisma.inventoryItem.update({ where: { id: existing.id }, data: item });
      } else {
        await prisma.inventoryItem.create({ data: { organizationId: org.id, ...item } });
      }
      count++;
    }
    console.log(`Seeded ${ITEMS.length} inventory items for ${org.name}`);
  }
  console.log(`Done. ${count} rows upserted across ${orgs.length} organizations.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
