import { prisma } from "@/lib/prisma";

/** Fixed row order for sheet "02.部门事件统计" and the monthly-score delta rule for sheet
 *  "03.部门安全考核得分" — mildest to most severe, matching the original report exactly.
 *  A1/A2/E/F are kept even though the live org only defines A/B/C/D, so nothing breaks if
 *  those extra severities are ever added. */
const SEVERITY_ORDER = ["A1", "A2", "A", "B", "C", "D", "E", "F"];

/** Monthly score delta per incident severity (sheet 03), user-provided business rule —
 *  hardcoded, not admin-editable, per the confirmed plan. */
const SEVERITY_MONTHLY_DELTA: Record<string, number> = {
  A1: 0,
  A2: 0,
  A: 0,
  B: -4,
  C: -6,
  D: -8,
  E: -10,
  F: -12,
};
const SCORE_BASELINE = 60;
const NO_INCIDENT_MONTHLY_DELTA = 2;

/** Judgment-criteria text for sheet "02.部门事件统计" column B, in both UI locales — a
 *  `short` fragment for at-a-glance display (the number that actually distinguishes this
 *  level from its neighbors) and the verbatim `full` text (Chinese copied from the original
 *  report; Vietnamese translated) shown as a hover tooltip. The live severity catalog only
 *  has a single "A" code (no A1/A2 split), so "A" uses A1's text, the milder sub-level. */
export type SeverityCriteriaText = { short: string; full: string };
const SEVERITY_CRITERIA: Record<string, Record<"vi" | "zh", SeverityCriteriaText>> = {
  A: {
    zh: { short: "＜6.800.000VNĐ", full: "事件未遂，无人员受伤；或发生经济损失＜6.800.000VNĐ的非人伤安全事件。" },
    vi: { short: "<6.800.000đ", full: "Sự cố suýt xảy ra, không có người bị thương; hoặc phát sinh thiệt hại kinh tế < 6.800.000VNĐ (sự cố an toàn không liên quan thương tích)." },
  },
  B: {
    zh: { short: "3.400.000–17.000.000VNĐ", full: "有人员受伤，3.400.000VNĐ≤产生医药费＜17.000.000VNĐ；或发生34.000.000VNĐ≤经济损失＜68.000.000VNĐ的非人伤安全事件。" },
    vi: { short: "3.400.000–17.000.000đ", full: "Có người bị thương, chi phí y tế từ 3.400.000VNĐ đến dưới 17.000.000VNĐ; hoặc phát sinh thiệt hại kinh tế từ 34.000.000VNĐ đến dưới 68.000.000VNĐ (sự cố an toàn không liên quan thương tích)." },
  },
  C: {
    zh: { short: "17.000.000–34.000.000VNĐ", full: "有人员受伤，17.000.000VNĐ≤产生医药费＜34.000.000VNĐ；或发生68.000.000VNĐ≤经济损失＜170.000.000VNĐ的非人伤安全事件。" },
    vi: { short: "17.000.000–34.000.000đ", full: "Có người bị thương, chi phí y tế từ 17.000.000VNĐ đến dưới 34.000.000VNĐ; hoặc phát sinh thiệt hại kinh tế từ 68.000.000VNĐ đến dưới 170.000.000VNĐ (sự cố an toàn không liên quan thương tích)." },
  },
  D: {
    zh: { short: "34.000.000–170.000.000VNĐ", full: "有人员受伤，34.000.000VNĐ≤产生医药费＜170.000.000VNĐ；或发生170.000.000VNĐ≤经济损失＜340.000.000VNĐ的非人伤安全事件。" },
    vi: { short: "34.000.000–170.000.000đ", full: "Có người bị thương, chi phí y tế từ 34.000.000VNĐ đến dưới 170.000.000VNĐ; hoặc phát sinh thiệt hại kinh tế từ 170.000.000VNĐ đến dưới 340.000.000VNĐ (sự cố an toàn không liên quan thương tích)." },
  },
  E: {
    zh: { short: "≥170.000.000VNĐ", full: "有人员受伤，产生医药费≥170.000.000VNĐ；或发生340.000.000VNĐ≤经济损失＜3.400.000.000VNĐ的非人伤安全事件。" },
    vi: { short: "≥170.000.000đ", full: "Có người bị thương, chi phí y tế từ 170.000.000VNĐ trở lên; hoặc phát sinh thiệt hại kinh tế từ 340.000.000VNĐ đến dưới 3.400.000.000VNĐ (sự cố an toàn không liên quan thương tích)." },
  },
  F: {
    zh: { short: "死亡 / ≥3.400.000.000VNĐ", full: "事件导致1人（含）以上死亡；或发生经济损失≥3.400.000.000VNĐ的非人伤安全事件。" },
    vi: { short: "Tử vong / ≥3.400.000.000đ", full: "Sự cố khiến từ 1 người tử vong trở lên; hoặc phát sinh thiệt hại kinh tế từ 3.400.000.000VNĐ trở lên." },
  },
};

/** Column order for sheet "02.部门事件统计" (21 columns, D through X in the source file —
 *  unlike sheet 04's 20 workshop rows, sheet 02 also breaks out 设备部/工艺部/行政科 AND an
 *  extra "废气物资/Lò hơi" (boiler) column that sheet 04 doesn't track at all). */
const SHEET02_WORKSHOP_CODES = [
  "raw-material",
  "backing-fabric-3",
  "paper-tube-3",
  "tufting-1",
  "tufting-2",
  "tufting-3",
  "backing-glue-1",
  "backing-glue-2",
  "straight-yarn-1",
  "straight-yarn-2",
  "curled-yarn-1",
  "curled-yarn-2",
  "curled-yarn-3",
  "supermarket-turf-3",
  "warehouse",
  "planning",
  "qa",
  "process",
  "equipment",
  "admin",
  "boiler",
];
/** The source file's own per-row 合计 formula is `SUM(D:W)` — it excludes the last (boiler)
 *  column, while the grand-total row's formula is `SUM(D:X)` — includes it. A genuine
 *  inconsistency in the original report, replicated here verbatim for exact fidelity. */
const SHEET02_ROW_TOTAL_EXCLUDES_LAST_COLUMN = true;

/** Sheet 04 (deduction points) and sheet 03 (monthly score) don't have a row for the boiler
 *  column at all — it only exists in sheet 02. */
function excludeSheet02OnlyWorkshops(workshops: WorkshopLite[]) {
  return workshops.filter((w) => w.code !== "boiler");
}

export type WorkshopLite = Awaited<ReturnType<typeof prisma.safetyWorkshop.findMany>>[number];

/** Guards against IEEE-754 drift from summing decimals (0.1 + 0.2 -> 0.30000000000000004),
 *  which otherwise leaks into the UI as a long ugly string (and stretches its table column). */
function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function yearRange(year: number) {
  return { gte: new Date(`${year}-01-01T00:00:00.000Z`), lt: new Date(`${year + 1}-01-01T00:00:00.000Z`) };
}

/** Builds the raw-departmentSnapshot -> canonical-workshop lookup. Resolved at read time
 *  (not frozen per-incident) so editing the mapping in /admin/hse-targets immediately
 *  changes how past incidents are grouped in sheets 02-04. */
export async function resolveWorkshopMap(organizationId: string) {
  const [aliases, workshops] = await Promise.all([
    prisma.departmentAlias.findMany({ where: { organizationId } }),
    prisma.safetyWorkshop.findMany({ where: { organizationId, isActive: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  const workshopById = new Map(workshops.map((w) => [w.id, w]));
  const aliasMap = new Map<string, WorkshopLite | null>();
  for (const a of aliases) {
    aliasMap.set(a.rawText, a.safetyWorkshopId ? (workshopById.get(a.safetyWorkshopId) ?? null) : null);
  }
  return { aliasMap, workshops };
}

/** Incidents created via the web form only ever set `orgUnitId` (a manually-picked dropdown) —
 *  `departmentSnapshot` is only ever populated by the Excel import pipeline or by copying an
 *  assigned employee's department. Falling back to the orgUnit's own name (matching the
 *  fallback already used for display everywhere else in this module) means a freshly-created
 *  incident is still classified into a workshop instead of silently vanishing from every report. */
function workshopFor(inc: { orgUnit: { name: string } | null; departmentSnapshot: string | null }, aliasMap: Map<string, WorkshopLite | null>) {
  const key = inc.orgUnit?.name ?? inc.departmentSnapshot ?? "";
  return aliasMap.get(key) ?? null;
}

export async function getAvailableReportYears(organizationId: string) {
  const incidents = await prisma.incident.findMany({ where: { organizationId }, select: { occurredAt: true } });
  const years = new Set(incidents.map((i) => i.occurredAt.getFullYear()));
  years.add(new Date().getFullYear());
  return [...years].sort((a, b) => b - a);
}

export async function getSheet02CrosstabData(organizationId: string, year: number) {
  const { aliasMap, workshops } = await resolveWorkshopMap(organizationId);
  const workshopByCode = new Map(workshops.map((w) => [w.code, w]));
  const columns = SHEET02_WORKSHOP_CODES.map((code) => workshopByCode.get(code)).filter(
    (w): w is WorkshopLite => !!w
  );

  const [incidents, severities] = await Promise.all([
    prisma.incident.findMany({
      where: { organizationId, occurredAt: yearRange(year) },
      include: { severity: true, orgUnit: { select: { name: true } } },
    }),
    prisma.incidentSeverity.findMany({ where: { organizationId } }),
  ]);

  const severityByCode = new Map(severities.map((s) => [s.code, s]));
  // Always shows all 6 real levels (A-F) as reference rows, even ones the org's live severity
  // catalog doesn't define yet (e.g. E/F, never used so far) — matching the original report,
  // which lists every level for context rather than only the ones with data. A1/A2 stay
  // excluded: the org has always used a single unsplit "A", never those two sub-codes.
  const severityRows = SEVERITY_ORDER.filter((code) => code !== "A1" && code !== "A2");

  const counts = new Map<string, number>();
  for (const inc of incidents) {
    const ws = workshopFor(inc, aliasMap);
    if (!ws) continue;
    const key = `${inc.severity.code}|${ws.code}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const rows = severityRows.map((code) => {
    const cells = columns.map((w) => counts.get(`${code}|${w.code}`) ?? 0);
    const cellsForRowTotal = SHEET02_ROW_TOTAL_EXCLUDES_LAST_COLUMN ? cells.slice(0, -1) : cells;
    return {
      severityCode: code,
      severityName: severityByCode.get(code)?.name ?? code,
      criteria: SEVERITY_CRITERIA[code] ?? null,
      cells,
      rowTotal: cellsForRowTotal.reduce((a, b) => a + b, 0),
    };
  });

  const totalsByColumn = columns.map((_, i) => rows.reduce((sum, r) => sum + r.cells[i], 0));
  const grandTotal = totalsByColumn.reduce((a, b) => a + b, 0);

  return { year, columns, rows, totalsByColumn, grandTotal };
}

export type Sheet03MonthCell = {
  score: number;
  delta: number;
  incidents: { id: string; incidentNumber: string; severityCode: string; description: string; occurredAt: Date }[];
};

function formatDateZh(d: Date): string {
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

/** The monthly score cell's hover note/tooltip — incident descriptions are already Chinese
 *  (verbatim from the source reports), so the summary/line wrapper text is written in Chinese
 *  too rather than mixing languages. Shared by the web tooltip (sheet03-score-table.tsx) and
 *  the Excel cell note (incidents/export/route.ts) so both stay identical. */
export function buildSheet03NoteParts(cell: {
  delta: number;
  incidents: { incidentNumber: string; severityCode: string; description: string; occurredAt: Date }[];
}): { summary: string; lines: string[] } | null {
  if (cell.incidents.length === 0) return null;
  const bySeverity = new Map<string, number>();
  for (const inc of cell.incidents) bySeverity.set(inc.severityCode, (bySeverity.get(inc.severityCode) ?? 0) + 1);
  const summary =
    Array.from(bySeverity.entries())
      .map(([code, count]) => `${count}起${code}级事故`)
      .join("、") + `，共计${cell.delta}分`;
  const lines = cell.incidents.map(
    (inc) => `${inc.severityCode}级 · ${inc.incidentNumber}（${formatDateZh(inc.occurredAt)}）：${inc.description}`
  );
  return { summary, lines };
}

export async function getSheet03ScoreData(organizationId: string, year: number) {
  const { aliasMap, workshops } = await resolveWorkshopMap(organizationId);
  const incidents = await prisma.incident.findMany({
    where: { organizationId, occurredAt: yearRange(year) },
    include: { severity: true, orgUnit: { select: { name: true } } },
  });

  // Normally caps at the current calendar month (so the table doesn't show a fictional
  // projected score for months that haven't happened yet), but extended to cover any month
  // that already has a real incident recorded — a forward-dated entry, or this server's
  // clock lagging the user's actual "today" — so a month with real data is never silently
  // dropped from the table, this year or any year going forward.
  const now = new Date();
  const clockElapsed = year === now.getFullYear() ? now.getMonth() + 1 : 12;
  const maxIncidentMonth = incidents.reduce((max, i) => Math.max(max, i.occurredAt.getMonth() + 1), 0);
  const monthsToCompute = Math.max(clockElapsed, maxIncidentMonth);

  type BucketedIncident = { id: string; incidentNumber: string; severityCode: string; description: string; occurredAt: Date };
  const bucket = new Map<string, BucketedIncident[][]>();
  for (const w of workshops) bucket.set(w.code, Array.from({ length: 13 }, () => [] as BucketedIncident[]));
  for (const inc of incidents) {
    const ws = workshopFor(inc, aliasMap);
    if (!ws) continue;
    const month = inc.occurredAt.getMonth() + 1;
    bucket.get(ws.code)?.[month]?.push({
      id: inc.id,
      incidentNumber: inc.incidentNumber,
      severityCode: inc.severity.code,
      description: inc.description,
      occurredAt: inc.occurredAt,
    });
  }

  const rows = excludeSheet02OnlyWorkshops(workshops).map((w) => {
    let score = SCORE_BASELINE;
    const monthlyScores: Sheet03MonthCell[] = [];
    for (let m = 1; m <= monthsToCompute; m++) {
      const monthIncidents = bucket.get(w.code)?.[m] ?? [];
      const delta =
        monthIncidents.length === 0
          ? NO_INCIDENT_MONTHLY_DELTA
          : monthIncidents.reduce((sum, i) => sum + (SEVERITY_MONTHLY_DELTA[i.severityCode] ?? 0), 0);
      score += delta;
      monthlyScores.push({ score, delta, incidents: monthIncidents });
    }
    return { workshop: w, monthlyScores };
  });

  return { year, monthsComputed: monthsToCompute, rows };
}

async function getDeductionByWorkshopMonth(organizationId: string, year: number, workshops: WorkshopLite[]) {
  const { aliasMap } = await resolveWorkshopMap(organizationId);
  const incidents = await prisma.incident.findMany({
    where: { organizationId, occurredAt: yearRange(year) },
    include: { orgUnit: { select: { name: true } } },
  });

  const bucket = new Map<string, number[]>();
  for (const w of workshops) bucket.set(w.code, Array.from({ length: 13 }, () => 0));
  for (const inc of incidents) {
    const ws = workshopFor(inc, aliasMap);
    if (!ws) continue;
    const month = inc.occurredAt.getMonth() + 1;
    const arr = bucket.get(ws.code);
    if (arr) arr[month] += inc.pointsDeducted ?? 0;
  }
  return bucket;
}

export const HSE_TARGET_METRIC = {
  deductionActual: "deduction_actual",
  deductionTarget: "deduction_target",
} as const;

export async function getSheet04DeductionData(organizationId: string, year: number) {
  const { workshops } = await resolveWorkshopMap(organizationId);
  const [bucket, targets] = await Promise.all([
    getDeductionByWorkshopMonth(organizationId, year, workshops),
    prisma.hseYearlyTarget.findMany({
      where: { organizationId, year: { in: [year - 1, year] }, safetyWorkshopId: { not: null } },
    }),
  ]);

  const targetMap = new Map<string, number>();
  for (const t of targets) targetMap.set(`${t.safetyWorkshopId}|${t.year}|${t.metricKey}`, t.value);

  const rows = excludeSheet02OnlyWorkshops(workshops).map((w) => {
    const monthly = (bucket.get(w.code) ?? []).slice(1).map(round2);
    const cumulative = round2(monthly.reduce((a, b) => a + b, 0));
    return {
      workshop: w,
      priorYearActual: targetMap.get(`${w.id}|${year - 1}|${HSE_TARGET_METRIC.deductionActual}`) ?? null,
      priorYearTarget: targetMap.get(`${w.id}|${year - 1}|${HSE_TARGET_METRIC.deductionTarget}`) ?? null,
      currentYearTarget: targetMap.get(`${w.id}|${year}|${HSE_TARGET_METRIC.deductionTarget}`) ?? null,
      monthly,
      cumulative,
    };
  });

  const totalRow = {
    monthly: Array.from({ length: 12 }, (_, i) => round2(rows.reduce((s, r) => s + r.monthly[i], 0))),
    cumulative: round2(rows.reduce((s, r) => s + r.cumulative, 0)),
  };

  return { year, rows, totalRow };
}

type KpiUnit = "起" | "分" | "%";
type KpiSource = "deduction_total" | "severity_ge_e" | "category_fire" | "manual";

export const KPI_ITEMS: {
  code: string;
  categoryVi: string;
  categoryZh: string;
  nameVi: string;
  nameZh: string;
  unit: KpiUnit;
  source: KpiSource;
  /** Some source-file targets are inequality thresholds ("≥90%"), not plain values —
   *  purely a display prefix, doesn't change the stored/compared numeric target. */
  targetDisplayPrefix?: string;
}[] = [
  { code: "safety_deduction_total", categoryVi: "An toàn", categoryZh: "安全", nameVi: "Các vấn đề an toàn bị trừ điểm", nameZh: "安全事件扣分", unit: "分", source: "deduction_total" },
  { code: "e_level_incidents", categoryVi: "An toàn", categoryZh: "安全", nameVi: "Các vấn đề an toàn cấp E trở lên", nameZh: "E级（含）以上安全事件", unit: "起", source: "severity_ge_e" },
  { code: "acute_poisoning", categoryVi: "An toàn", categoryZh: "安全", nameVi: "Số vụ ngộ độc cấp tính", nameZh: "急性中毒事件数", unit: "起", source: "manual" },
  { code: "occupational_disease", categoryVi: "An toàn", categoryZh: "安全", nameVi: "Số vụ mắc bệnh nghề nghiệp", nameZh: "职业病发病数", unit: "起", source: "manual" },
  { code: "major_fire", categoryVi: "PCCC", categoryZh: "消防", nameVi: "Số vụ cháy nổ lớn", nameZh: "重大火灾或爆炸事件数", unit: "起", source: "category_fire" },
  { code: "hazard_rectification_rate", categoryVi: "Kiểm tra", categoryZh: "稽核检查", nameVi: "Tỷ lệ giải quyết các nguy hiểm tiềm ẩn", nameZh: "安全隐患整改率", unit: "%", source: "manual", targetDisplayPrefix: "≥" },
  { code: "training_participation_rate", categoryVi: "Tập huấn", categoryZh: "培训", nameVi: "Tỷ lệ tham gia đào tạo 3 cấp an toàn", nameZh: "三级安全教育培训参与率", unit: "%", source: "manual" },
  { code: "major_env_pollution", categoryVi: "Môi trường", categoryZh: "环保", nameVi: "Số vụ ô nhiễm môi trường nặng", nameZh: "较大及以上环境污染事件数", unit: "起", source: "manual" },
  { code: "major_env_complaints", categoryVi: "Môi trường", categoryZh: "环保", nameVi: "Số vụ khiếu nại về vấn đề bảo vệ môi trường", nameZh: "重大环保投诉数", unit: "起", source: "manual" },
  { code: "env_complaint_resolution_rate", categoryVi: "Môi trường", categoryZh: "环保", nameVi: "Tỷ lệ giải quyết các khiếu nại nội bộ", nameZh: "内外部环保投诉有效处理率", unit: "%", source: "manual" },
];

function monthlyKey(code: string, month: number) {
  return `kpi_${code}_m${String(month).padStart(2, "0")}`;
}
function targetKey(code: string) {
  return `kpi_${code}_target`;
}
/** Lets an admin correct a single year's yearly total for a *computed* KPI (e.g. the incident
 *  log is missing/mis-tagged one historical record) without turning that KPI fully manual —
 *  future years keep auto-computing from live incident data unless this is also set for them. */
function actualOverrideKey(code: string) {
  return `kpi_${code}_actual_override`;
}

async function computeKpiMonthly(
  organizationId: string,
  year: number,
  item: (typeof KPI_ITEMS)[number],
  manualValues: Map<string, number>
): Promise<number[]> {
  if (item.source === "manual") {
    return Array.from({ length: 12 }, (_, i) => manualValues.get(monthlyKey(item.code, i + 1)) ?? 0);
  }

  const incidents = await prisma.incident.findMany({
    where: { organizationId, occurredAt: yearRange(year) },
    include: { severity: true, category: true },
  });
  const monthly = Array.from({ length: 12 }, () => 0);
  for (const inc of incidents) {
    const m = inc.occurredAt.getMonth();
    if (item.source === "deduction_total") monthly[m] += inc.pointsDeducted ?? 0;
    else if (item.source === "severity_ge_e" && (inc.severity.code === "E" || inc.severity.code === "F")) monthly[m] += 1;
    else if (item.source === "category_fire" && inc.category.name.includes("火灾")) monthly[m] += 1;
  }
  return monthly.map(round2);
}

/** Months to treat as "elapsed" for a given year — mirrors the original file's own formula
 *  `SUM(range)/COUNT(range)`, where COUNT only counts cells that actually have a value (i.e.
 *  months that have happened yet). Averaging a % KPI over all 12 slots regardless would dilute
 *  it with not-yet-reached future months, which always default to 0. */
function monthsElapsed(year: number) {
  const now = new Date();
  return year === now.getFullYear() ? now.getMonth() + 1 : 12;
}

/** Highest 1-based month index with a genuinely nonzero value — a later month that's still 0
 *  is ambiguous (hasn't happened yet, or genuinely had no incidents), so this only ever
 *  extends coverage, never shrinks it. Lets `monthsElapsed` be overridden per-KPI when a
 *  month beyond the clock-elapsed cutoff already has real data (a forward-dated incident, or
 *  the server's clock lagging the user's actual "today") instead of silently hiding it. */
function latestMonthWithData(monthly: number[]) {
  for (let m = monthly.length; m >= 1; m--) {
    if (monthly[m - 1] !== 0) return m;
  }
  return 0;
}

export async function getSheet05KpiData(organizationId: string, year: number) {
  const targets = await prisma.hseYearlyTarget.findMany({
    where: { organizationId, safetyWorkshopId: null, year: { in: [year - 1, year] } },
  });
  const manualValues = new Map<string, number>();
  const targetValues = new Map<string, number>();
  const overrideByYearMetric = new Map<string, number>();
  for (const t of targets) {
    overrideByYearMetric.set(`${t.year}|${t.metricKey}`, t.value);
    if (t.year === year) {
      manualValues.set(t.metricKey, t.value);
      targetValues.set(t.metricKey, t.value);
    } else {
      manualValues.set(`prior:${t.metricKey}`, t.value);
    }
  }
  const priorManualValues = new Map<string, number>();
  for (const [k, v] of manualValues) if (k.startsWith("prior:")) priorManualValues.set(k.slice(6), v);

  const computed = await Promise.all(
    KPI_ITEMS.map(async (item) => {
      const monthly = await computeKpiMonthly(organizationId, year, item, manualValues);
      const priorMonthly =
        item.source === "manual"
          ? Array.from({ length: 12 }, (_, i) => priorManualValues.get(monthlyKey(item.code, i + 1)) ?? 0)
          : await computeKpiMonthly(organizationId, year - 1, item, priorManualValues);

      // See latestMonthWithData: extends past the clock-elapsed cutoff whenever this KPI
      // already has real data beyond it. Only meaningful for incident-derived KPIs, where a
      // nonzero month unambiguously means a real incident happened then — "manual" KPIs are
      // admin-entered targets/rates pre-seeded for the whole year as a baseline (e.g. 100%
      // every month), so a nonzero later month there is a placeholder default, not evidence
      // that month has actually happened.
      const elapsedCurrent =
        item.source === "manual" ? monthsElapsed(year) : Math.max(monthsElapsed(year), latestMonthWithData(monthly));
      const elapsedPrior =
        item.source === "manual" ? monthsElapsed(year - 1) : Math.max(monthsElapsed(year - 1), latestMonthWithData(priorMonthly));

      const aggregate = (vals: number[], elapsedMonths: number) =>
        item.unit === "%"
          ? vals.slice(0, elapsedMonths).reduce((a, b) => a + b, 0) / Math.max(1, elapsedMonths)
          : round2(vals.reduce((a, b) => a + b, 0));

      // A computed KPI's yearly total can be corrected per-year (e.g. the incident log is
      // missing/mis-tagged one historical record) without switching it fully to manual entry —
      // falls back to the live/manual aggregate whenever no override is set for that year.
      const overrideKey = actualOverrideKey(item.code);
      const priorYearActual = overrideByYearMetric.get(`${year - 1}|${overrideKey}`) ?? aggregate(priorMonthly, elapsedPrior);
      const currentYearActual = overrideByYearMetric.get(`${year}|${overrideKey}`) ?? aggregate(monthly, elapsedCurrent);

      return {
        row: {
          ...item,
          priorYearActual,
          currentYearTarget: targetValues.get(targetKey(item.code)) ?? null,
          currentYearActual,
          monthly,
        },
        elapsedCurrent,
      };
    })
  );

  // The UI shows one shared set of month columns for every KPI row, so if any single KPI
  // already has real data past the clock-elapsed cutoff (e.g. a forward-dated incident),
  // the whole table extends to show that month rather than hiding it for every row.
  const sheetMonthsElapsed = Math.max(monthsElapsed(year), ...computed.map((c) => c.elapsedCurrent));

  return { year, monthsElapsed: sheetMonthsElapsed, rows: computed.map((c) => c.row) };
}
