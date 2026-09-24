// One-off: enters the two hand-written 安全事件调查报告 (incident investigation reports) of
// 2026-09-10 and 2026-09-20 into the Incidents module — the same fields, defaults and derived
// values ("Số hiệu sự cố", Mã nhà máy, Điểm trừ, nhân viên snapshot, audit log) the "Thêm sự cố"
// form itself produces (see incidents/new/actions.ts), so they are indistinguishable from
// incidents typed in by hand.
//
// Safe by design: only ever INSERTS new incidents, never edits or deletes anything, and skips an
// incident that already exists (same time + same description) so re-running is harmless.
//   Preview only (writes nothing):  npx tsx scripts/add-incidents-sep-2026.ts --dry
//   Really create them:             npx tsx scripts/add-incidents-sep-2026.ts

import { prisma } from "@/lib/prisma";
import { generateIncidentNumber } from "@/server/incidents";
import { writeAuditLog } from "@/server/audit";
import { DEFAULT_POINTS_DEDUCTED_BY_SEVERITY, deriveFactoryCode } from "@/lib/incident-constants";

const DRY = process.argv.includes("--dry");

// 轻微事件 ("minor") on the report's 6-level scale = severity B in the org's A–F scale
// (A = 未遂 near-miss, never deducts; B 0.1; C 0.3; D 0.5; E/F = 重大/特大).
const SEVERITY_CODE = "B";
// Both injuries came from a machine/roller — the closest of the org's 8 accident categories.
const CATEGORY_NAME = "机械/设备事故";
const ORG_UNIT_NAME = "二期背胶";

type Report = {
  reportNo: string;
  occurredAtLocal: string; // same "YYYY-MM-DDTHH:mm" string the form's date-time field submits
  investigationStart: string;
  locationDetail: string;
  employeeCode: string;
  employeeNameFallback: string;
  bodyPartCandidates: string[]; // Chinese first (the module's data is authored in Chinese), Vietnamese second
  description: string;
  findings: string;
  history: string;
  cause: string;
  people: string;
  equipmentFactor: string;
  technicalFactor: string;
  otherAdvice: string;
  trainingContent: string;
  trainingEffect: string;
  lecturer: string;
  attendees: string;
  consequence: string;
  liability: string;
  partyOpinion: string;
  teamLeader: string;
  teamMember: string;
  hseOpinion: string;
};

const REPORTS: Report[] = [
  {
    reportNo: "0904",
    occurredAtLocal: "2026-09-10T15:15",
    investigationStart: "2026-09-10",
    locationDetail: "二期背胶打卷机34#",
    employeeCode: "39525",
    employeeNameFallback: "NGUYỄN VĂN BÉ TƯ",
    bodyPartCandidates: ["手", "Bàn tay"],
    description: "在二期背胶34#打卷有一个男员工39525,NGUYỄN VĂN BÉ TƯ 手被卡在AB辊已经带去医院检查",
    findings: "员工手被卡里面AB辊",
    history: "有",
    cause: "员操违反操作",
    people: "培训全员工生产过程中要停机放缠绕膜",
    equipmentFactor: "无",
    technicalFactor: "无",
    otherAdvice: "无",
    trainingContent: "培训全员工生产过程中要停机放缠绕膜",
    trainingEffect: "在跟踪",
    lecturer: "吴明雄",
    attendees: "全部员工",
    consequence: "手被骨折两个地方",
    liability: "安全员按公祠规定处罚，员工处罚10分",
    partyOpinion: "无",
    teamLeader: "杜俊微",
    teamMember: "吴明雄",
    hseOpinion: "同意",
  },
  {
    reportNo: "09-04",
    occurredAtLocal: "2026-09-20T16:20",
    investigationStart: "2026-09-20",
    locationDetail: "二期背胶上胶33#",
    employeeCode: "58592",
    employeeNameFallback: "PHAN KIM DUYÊN",
    bodyPartCandidates: ["脚", "Bàn chân"],
    description: "在二期背胶上胶地方有一个女员工：58592 PHAN KIM DUYÊN 脚被圆辊掉落已经带去医院检查",
    findings: "员工的脚被圆辊掉落受伤",
    history: "无",
    cause: "生产过程中因为订单要求要用圆辊，然后用完了要拿下来的时候不注意把这个圆辊掉落到员工的脚",
    people: "培训全员工生产",
    equipmentFactor: "无",
    technicalFactor: "无",
    otherAdvice: "无",
    trainingContent: "培训全员工生产拿圆辊下来要注意",
    trainingEffect: "在跟踪",
    lecturer: "吴明雄",
    attendees: "全部员工",
    consequence: "脚部为淤血肿胀",
    liability: "安全员按公祠规定处罚",
    partyOpinion: "无",
    teamLeader: "吴明雄",
    teamMember: "安全员",
    hseOpinion: "同意",
  },
];

/** Everything in the report with no dedicated field on the incident form, kept verbatim in
 *  "Ghi chú" so nothing from the paper report is lost. */
function buildNotes(r: Report): string {
  return [
    `安全事件调查报告 编号：${r.reportNo}`,
    `调查开始时间：${r.investigationStart}`,
    `事件性质：人身伤害　事件级别：轻微事件`,
    `调查发现要点：${r.findings}`,
    `历史事件：${r.history}`,
    `设备相关：${r.equipmentFactor}`,
    `技术相关：${r.technicalFactor}`,
    `其它建议：${r.otherAdvice}`,
    `效果评价：${r.trainingEffect}`,
    `主讲人：${r.lecturer}`,
    `参与培训人员：${r.attendees}`,
    `事件后果：${r.consequence}`,
    `责任认定及处罚决定：${r.liability}`,
    `事件当事人意见：${r.partyOpinion}`,
    `调查小组组长：${r.teamLeader}`,
    `调查小组成员：${r.teamMember}`,
    `安环部意见：${r.hseOpinion}`,
  ].join("\n");
}

async function main() {
  console.log(DRY ? "== DRY RUN — nothing will be written ==" : "== Creating incidents ==");

  const orgs = await prisma.organization.findMany({ where: { name: { in: ["CG", "CCG"] } } });
  if (orgs.length !== 1) throw new Error(`Expected exactly one CG/CCG organization, found ${orgs.length}.`);
  const org = orgs[0];

  const [category, severity, orgUnit] = await Promise.all([
    prisma.incidentCategory.findFirst({ where: { organizationId: org.id, name: CATEGORY_NAME } }),
    prisma.incidentSeverity.findUnique({ where: { organizationId_code: { organizationId: org.id, code: SEVERITY_CODE } } }),
    prisma.orgUnit.findFirst({ where: { organizationId: org.id, name: ORG_UNIT_NAME } }),
  ]);
  if (!category) throw new Error(`Incident category "${CATEGORY_NAME}" not found.`);
  if (!severity) throw new Error(`Incident severity "${SEVERITY_CODE}" not found.`);
  if (!orgUnit) console.log(`! Org unit "${ORG_UNIT_NAME}" not found — "Bộ phận" will be left empty.`);

  // Same "who reported it" the form records: the signed-in account. No session here, so use the
  // organization's platform administrator account.
  const reporter = await prisma.user.findFirst({ where: { isPlatformAdmin: true }, orderBy: { createdAt: "asc" } });

  const factoryCode = deriveFactoryCode(orgUnit?.name);
  const pointsDeducted = DEFAULT_POINTS_DEDUCTED_BY_SEVERITY[SEVERITY_CODE] ?? null;

  for (const r of REPORTS) {
    const occurredAt = new Date(r.occurredAtLocal);
    const existing = await prisma.incident.findFirst({ where: { organizationId: org.id, occurredAt, description: r.description }, select: { incidentNumber: true } });
    if (existing) {
      console.log(`- ${r.reportNo}: already exists as ${existing.incidentNumber} — skipped.`);
      continue;
    }

    const employee = await prisma.employee.findFirst({ where: { organizationId: org.id, employeeCode: r.employeeCode }, include: { orgUnit: true } });
    const employeeSnapshot = employee
      ? {
          employeeId: employee.id,
          employeeNameSnapshot: employee.fullName,
          employeeCodeSnapshot: employee.employeeCode,
          departmentSnapshot: employee.orgUnit?.name ?? null,
          positionSnapshot: employee.position,
          shiftSnapshot: employee.shift,
        }
      : { employeeNameSnapshot: r.employeeNameFallback, employeeCodeSnapshot: r.employeeCode };
    if (!employee) console.log(`! ${r.reportNo}: employee ${r.employeeCode} not found in the roster — saved with name/code only (not linked).`);

    // Prefer the spelling already used by existing incidents so the "Vị trí bị thương" chart groups them together.
    let injuredBodyPart = r.bodyPartCandidates[0];
    for (const candidate of r.bodyPartCandidates) {
      if ((await prisma.incident.count({ where: { organizationId: org.id, injuredBodyPart: candidate } })) > 0) {
        injuredBodyPart = candidate;
        break;
      }
    }

    const incidentNumber = await generateIncidentNumber(org.id, occurredAt);
    const data = {
      organizationId: org.id,
      incidentNumber,
      occurredAt,
      orgUnitId: orgUnit?.id ?? null,
      locationDetail: r.locationDetail,
      categoryId: category.id,
      severityId: severity.id,
      description: r.description,
      immediateCause: r.cause,
      correctiveAction: r.trainingContent,
      preventiveAction: `人员相关：${r.people}`,
      pointsDeducted,
      injuredBodyPart,
      sourceRowData: factoryCode ? { "工厂代码": factoryCode } : undefined,
      notes: buildNotes(r),
      reportedById: reporter?.id ?? null,
      ...employeeSnapshot,
    };

    console.log(`+ ${r.reportNo}: ${incidentNumber} | ${r.occurredAtLocal} | ${r.locationDetail} | ${employee ? "linked to " + employee.fullName : "unlinked"} | ${injuredBodyPart} | points ${pointsDeducted} | factory ${factoryCode}`);
    if (DRY) continue;

    const created = await prisma.incident.create({ data });
    await writeAuditLog({ organizationId: org.id, userId: reporter?.id ?? null, module: "incident", recordType: "Incident", recordId: created.id, action: "create" });
  }
}

main()
  .then(() => console.log("Done."))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
