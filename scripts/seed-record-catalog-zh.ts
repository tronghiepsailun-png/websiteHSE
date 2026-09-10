import { prisma } from "../src/lib/prisma";

// Draft Chinese translations for the PCCC catalog — descriptive names/units/frequencies are
// translated directly; Vietnamese legal citation numbers (Luật/Nghị định/Thông tư/TCVN
// numbers) are kept as their official codes since those identify a specific Vietnamese legal
// document that doesn't have a Chinese equivalent, with the surrounding text translated.
const GROUPS: Record<string, string> = {
  "cmsvktv86000518vx9cjy0tfa": "原始法律档案", // A · Hồ sơ pháp lý gốc
  "cmsvktzp7001w18vxhs93kwlo": "工程技术档案", // B · Hồ sơ kỹ thuật công trình
  "cmsvku3s9003e18vx41zd3gkt": "运行 - 定期跟踪", // C · Vận hành - theo dõi định kỳ
  "cmsvkuatd005r18vxtcg4ukt0": "保险与检定档案", // D · Hồ sơ bảo hiểm – kiểm định
};

type TypeTranslation = {
  nameZh: string;
  legalBasisZh?: string;
  frequencyLabelZh?: string;
  responsibleUnitZh?: string;
};

const RESPONSIBLE_UNIT_ZH: Record<string, string> = {
  "Cơ sở tự lập": "单位自行制定",
  "Cơ quan Cảnh sát PCCC": "公安消防机关",
  "Bộ phận An toàn": "安全部门",
  "Đơn vị huấn luyện ngoài": "外部培训单位",
  "Công ty bảo hiểm": "保险公司",
  "Đơn vị kiểm định bên ngoài": "外部检定单位",
  "Đơn vị bảo trì bên ngoài": "外部维保单位",
};

const TYPES: Record<string, TypeTranslation> = {
  // A1
  cmsvktvbs000618vx2t96xeev: {
    nameZh: "基础信息表（PC01）",
    legalBasisZh: "《105/2025/NĐ-CP号法令》第4条第1款",
    frequencyLabelZh: "制定并在发生变化时更新",
  },
  // A2
  cmsvktw2u000g18vxs2q6mc5j: {
    nameZh: "消防安全规定",
    legalBasisZh: "《第55/2024/QH15号消防与救援法》",
    frequencyLabelZh: "制定并在发生变化时更新",
  },
  // A3
  cmsvktwti000q18vxqrbf3vhn: {
    nameZh: "消防安全规定颁布决定",
    legalBasisZh: "《第55/2024/QH15号消防与救援法》",
    frequencyLabelZh: "制定并在发生变化时更新",
  },
  // A4
  cmsvktxjv001018vxkg9wkok2: {
    nameZh: "基层消防队名单",
    legalBasisZh: "《105/2025/NĐ-CP号法令》",
    frequencyLabelZh: "人员变动时更新",
  },
  // A5
  cmsvktya9001c18vxb69u0tlc: {
    nameZh: "消防检查人员分工决定",
    legalBasisZh: "《105/2025/NĐ-CP号法令》",
    frequencyLabelZh: "发生变化时更新",
  },
  // A6
  cmsvktz0v001m18vxyq0km6wc: {
    nameZh: "基层消防队成立决定",
    legalBasisZh: "《105/2025/NĐ-CP号法令》",
    frequencyLabelZh: "人员变动时更新",
  },
  // B1
  cmsvktzts001x18vxunzv4om0: {
    nameZh: "消防设计审批证书",
    legalBasisZh: "《第55/2024/QH15号法律》第17条（消防设计审批）",
    frequencyLabelZh: "建设/改造时一次性办理",
  },
  // B2
  cmsvku0hq002718vxque6zioy: {
    nameZh: "消防验收结果批准文件",
    legalBasisZh:
      "《第55/2024/QH15号法律》第18条（消防验收、验收工作检查）；附系统验收记录，依据TCVN 5738:2021 / TCVN 7336:2021标准",
    frequencyLabelZh: "投入使用前一次性办理",
  },
  // B4
  cmsvku174002j18vxfsle3p85: {
    nameZh: "灭火与救援预案（PC06）",
    legalBasisZh: "《第55/2024/QH15号法律》第10条（制定、演练灭火救援预案）",
    frequencyLabelZh: "制定并在发生变化时更新",
  },
  // B5
  cmsvku292002t18vxyopejmfv: {
    nameZh: "厂房平面图",
    legalBasisZh: "TCVN 3890:2023标准",
    frequencyLabelZh: "结构变化时更新",
  },
  // B6
  cmsvku31e003418vxkewqs07t: {
    nameZh: "厂房疏散示意图（三个区域共用）",
    legalBasisZh: "TCVN 3890:2023标准",
    frequencyLabelZh: "平面布局变化时更新",
  },
  // C1
  cmsvku3vl003f18vxv2v25jq1: {
    nameZh: "消防器材设备统计表",
    legalBasisZh: "TCVN 3890:2023标准",
    frequencyLabelZh: "发生变化时更新",
  },
  // C2
  cmsvku4hl003n18vx3jkpnaji: {
    nameZh: "消防器材跟踪登记簿（表01）",
    legalBasisZh: "《第36/2025/TT-BCA号通知》",
    frequencyLabelZh: "经常记录",
  },
  // C3
  cmsvku58r003x18vx5hmyvm70: {
    nameZh: "消防自查记录（PC02）",
    legalBasisZh: "《第55/2024/QH15号法律》第11条（消防检查）；《105/2025/NĐ-CP号法令》第13-14条",
    frequencyLabelZh: "每月",
  },
  // C4
  cmsvku62b004718vx71xfunyv: {
    nameZh: "消防工作结果报告（PC04）",
    legalBasisZh: "《105/2025/NĐ-CP号法令》第14条（第2款）",
    frequencyLabelZh: "每6个月一次",
  },
  // C5
  cmsvku6yj004i18vx5e14ghac: {
    nameZh: "公安消防检查记录（PC03）",
    legalBasisZh: "《第55/2024/QH15号法律》第11条（消防检查）",
    frequencyLabelZh: "按消防机关检查计划",
  },
  // C6
  cmsvku7lt004q18vxbwjud9b9: {
    nameZh: "灭火预案演练计划",
    legalBasisZh: "《第55/2024/QH15号法律》第10条（制定、演练灭火救援预案）",
    frequencyLabelZh: "每年至少1次",
  },
  // C7
  cmsvku84e004w18vx2f2xn9fs: {
    nameZh: "灭火预案演练结果报告",
    legalBasisZh: "《第55/2024/QH15号法律》第10条（制定、演练灭火救援预案）",
    frequencyLabelZh: "每年至少1次",
  },
  // C8
  cmsvku8n3005218vxr05teolw: {
    nameZh: "演练经验总结会议记录",
    legalBasisZh: "《第55/2024/QH15号法律》第10条（制定、演练灭火救援预案）",
    frequencyLabelZh: "每次演练后",
  },
  // C9
  cmsvku96b005818vxjc4lnz2i: {
    nameZh: "消防演练记录",
    legalBasisZh: "《第55/2024/QH15号法律》第10条（制定、演练灭火救援预案）",
    frequencyLabelZh: "每次演练后",
  },
  // C10
  cmsvkua3x005h18vxn55mh9y8: {
    nameZh: "消防培训档案（三个区域共用）",
    legalBasisZh: "《第55/2024/QH15号法律》第45条；《105/2025/NĐ-CP号法令》第28-29条（消防业务培训）",
    frequencyLabelZh: "每5年一次或有新员工时",
  },
  // D1
  cmsvkuaxa005s18vx0tb5cdhm: {
    nameZh: "强制火灾爆炸保险",
    legalBasisZh: "《67/2023/NĐ-CP号法令》",
    frequencyLabelZh: "按合同每年续保",
  },
  // D2
  cmsvkubo8006418vxz7blwf9u: {
    nameZh: "消防设备检定记录－灭火器",
    legalBasisZh: "TCVN 3890:2023标准",
    frequencyLabelZh: "按检定规定定期进行",
  },
  // D3
  cmsvkuc8a006a18vxahj7dpxg: {
    nameZh: "消防设备检定记录－报警灭火系统",
    legalBasisZh: "TCVN 5738:2021 / TCVN 7336:2021标准",
    frequencyLabelZh: "按检定规定定期进行",
  },
  // D4
  cmsvkucq7006g18vxluuidrm1: {
    nameZh: "消防器材检定证书（公安消防机关颁发）",
    legalBasisZh:
      "《第55/2024/QH15号法律》第六章（第43-44条，消防器材）－尚未确认具体检定通知文号，需进一步核实",
    frequencyLabelZh: "新购/更换时",
  },
  // D5
  cmsvkud8h006k18vxj26ezfim: {
    nameZh: "消防系统定期保养维护记录",
    legalBasisZh: "TCVN 3890:2023标准",
    frequencyLabelZh: "按厂家建议定期进行",
  },
};

async function main() {
  for (const [id, nameZh] of Object.entries(GROUPS)) {
    await prisma.recordGroup.update({ where: { id }, data: { nameZh } });
  }
  console.log(`Updated ${Object.keys(GROUPS).length} record groups`);

  let updatedTypes = 0;
  for (const [id, tr] of Object.entries(TYPES)) {
    const existing = await prisma.recordType.findUnique({ where: { id }, select: { responsibleUnit: true } });
    if (!existing) {
      console.warn(`RecordType ${id} not found, skipping`);
      continue;
    }
    const responsibleUnitZh = existing.responsibleUnit ? RESPONSIBLE_UNIT_ZH[existing.responsibleUnit] : null;
    await prisma.recordType.update({
      where: { id },
      data: {
        nameZh: tr.nameZh,
        legalBasisZh: tr.legalBasisZh ?? null,
        frequencyLabelZh: tr.frequencyLabelZh ?? null,
        responsibleUnitZh: responsibleUnitZh ?? null,
      },
    });
    updatedTypes++;
  }
  console.log(`Updated ${updatedTypes} record types`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
