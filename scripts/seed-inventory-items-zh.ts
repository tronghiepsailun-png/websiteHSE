import { prisma } from "../src/lib/prisma";

const NAME_ZH: Record<string, string> = {
  "Tủ chữa cháy trong nhà": "室内消防柜",
  "Tủ chữa cháy ngoài trời": "室外消防柜",
  "Gương cầu lồi": "凸面镜",
  "Đèn bắt côn trùng": "灭虫灯",
  "Lăng chữa cháy D50": "消防水枪 D50",
  "Lăng chữa cháy D65": "消防水枪 D65",
  "Dây chữa cháy D50": "消防水带 D50",
  "Dây chữa cháy D65": "消防水带 D65",
  "Chuông báo cháy": "火灾报警铃",
  "Nút nhấn báo cháy": "火灾报警按钮",
  "Đèn tín hiệu": "警示灯",
  "Bảng tiêu lệnh PCCC": "消防指令牌",
  "Đồng phục PCCC": "消防制服",
  "Mũ PCCC": "消防头盔",
  "Ủng PCCC": "消防靴",
};

async function main() {
  let count = 0;
  for (const [name, nameZh] of Object.entries(NAME_ZH)) {
    const { count: updated } = await prisma.inventoryItem.updateMany({ where: { name }, data: { nameZh } });
    count += updated;
  }
  console.log(`Updated nameZh on ${count} inventory item rows`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
