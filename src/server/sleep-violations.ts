import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";

export const SLEEP_MODULE = "sleep";

/** Amounts the company's own sheet uses on every row — prefilled, still editable per row. */
export const SLEEP_DEFAULT_AMOUNTS = { fine: 600_000, liable: 100_000, reward: 500_000 };

/** "Trừ toàn bộ hiệu suất tháng {thang}， tính ngày {ngay} không phép" → the real month/date of
 *  the check, so picking the preset writes exactly what the sheet says for that row. */
export function fillNoteTemplate(text: string, checkDate: Date) {
  const d = checkDate.getUTCDate();
  const m = checkDate.getUTCMonth() + 1;
  const y = checkDate.getUTCFullYear();
  return text.replaceAll("{thang}", String(m)).replaceAll("{ngay}", `${d}/${m}/${y}`);
}

/** The employee roster stores names in capitals ("TRẦN MINH TUYỀN"); the sheet writes them in
 *  normal case ("Trần Minh Tuyền"). */
export function properCaseName(name: string) {
  return name
    .trim()
    .toLocaleLowerCase("vi")
    .split(/\s+/)
    .map((w) => w.charAt(0).toLocaleUpperCase("vi") + w.slice(1))
    .join(" ");
}

export async function availableSleepViolationMonths(organizationId: string): Promise<{ year: number; month: number }[]> {
  const rows = await prisma.sleepViolation.findMany({
    where: { organizationId },
    select: { periodYear: true, periodMonth: true },
    distinct: ["periodYear", "periodMonth"],
  });
  const now = new Date();
  const periods = new Map(rows.map((r) => [`${r.periodYear}-${r.periodMonth}`, { year: r.periodYear, month: r.periodMonth }]));
  periods.set(`${now.getFullYear()}-${now.getMonth() + 1}`, { year: now.getFullYear(), month: now.getMonth() + 1 });
  return Array.from(periods.values()).sort((a, b) => b.year - a.year || b.month - a.month);
}

export async function listSleepViolations(organizationId: string, filters: { year: number; month: number; search?: string }) {
  const q = filters.search?.trim();
  return prisma.sleepViolation.findMany({
    where: {
      organizationId,
      periodYear: filters.year,
      periodMonth: filters.month,
      ...(q
        ? {
            OR: [
              { employeeCode: { contains: q } },
              { employeeName: { contains: q } },
              { liableCode: { contains: q } },
              { liableName: { contains: q } },
              { guardNameVi: { contains: q } },
              { location: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: [{ checkDate: "asc" }, { createdAt: "asc" }],
  });
}

export type SleepViolationRow = Awaited<ReturnType<typeof listSleepViolations>>[number];

export function summarizeSleepViolations(rows: { fineAmountVnd: number | null; liableFineVnd: number | null; guardRewardVnd: number | null }[]) {
  return rows.reduce(
    (acc, r) => ({
      count: acc.count + 1,
      fine: acc.fine + (r.fineAmountVnd ?? 0),
      liable: acc.liable + (r.liableFineVnd ?? 0),
      reward: acc.reward + (r.guardRewardVnd ?? 0),
    }),
    { count: 0, fine: 0, liable: 0, reward: 0 }
  );
}

// ---- Default quick-pick lists (taken from the company's own September sheet) ----

type Seed = { nameVi: string; nameZh?: string; code?: string; color?: string };

const DEFAULT_LISTS: Record<string, Seed[]> = {
  location: [
    "sợi cong xưởng 1",
    "sợi cong xưởng 2",
    "sợi thẳng xưởng 1",
    "sợi thẳng xưởng 2",
    "dệt xưởng 1",
    "dệt xưởng 2",
    "vải nền xưởng 3",
    "nguyên liệu xưởng 1",
    "nguyên liệu xưởng 2",
    "bảo trì sợi xưởng 2",
    "phát liệu sợi xưởng 1",
    "phát liệu sợi xưởng 2",
    "phủ keo xưởng 1",
    "phủ keo xưởng 2",
  ].map((nameVi) => ({ nameVi })),
  note: [
    { nameVi: "Trừ toàn bộ hiệu suất tháng {thang}， tính ngày {ngay} không phép", nameZh: "扣当月考核奖金，当日算旷工" },
    { nameVi: "Sa thải", nameZh: "开除" },
  ],
};

// The four guards on the September sheet keep the exact fills used there; any other guard gets
// the next color from a set of the same kind of clear, readable Excel standard fills.
const KNOWN_GUARD_COLORS: Record<string, string> = { "58820": "#92D050", "58025": "#00B0F0", "58914": "#E26B0A", "58636": "#FF0000" };
const GUARD_PALETTE = ["#FFC000", "#B4A7D6", "#F4B183", "#9BC2E6", "#C9C9C9", "#A9D08E", "#FFD966", "#F8CBAD", "#8EA9DB", "#D9D2E9"];

/** Fills any of this module's lists that are still empty, so the first visit already has
 *  everything to pick from. Never touches a list the org has already started editing. */
export async function ensureSleepCatalogSeeded(organizationId: string) {
  const counts = await prisma.catalogItem.groupBy({
    by: ["kind"],
    where: { organizationId, module: SLEEP_MODULE },
    _count: true,
  });
  const seeded = new Set(counts.map((c) => c.kind));

  const rows: (Seed & { kind: string; sortOrder: number })[] = [];
  for (const [kind, items] of Object.entries(DEFAULT_LISTS)) {
    if (!seeded.has(kind)) items.forEach((item, i) => rows.push({ ...item, kind, sortOrder: i }));
  }

  if (!seeded.has("guard")) {
    const guards = await prisma.employee.findMany({
      where: { organizationId, position: "保安", status: "active" },
      orderBy: [{ shift: "asc" }, { fullName: "asc" }],
      select: { employeeCode: true, fullName: true, fullNameZh: true },
    });
    let next = 0;
    guards.forEach((g, i) =>
      rows.push({
        kind: "guard",
        nameVi: properCaseName(g.fullName),
        nameZh: g.fullNameZh ?? undefined,
        code: g.employeeCode,
        color: KNOWN_GUARD_COLORS[g.employeeCode] ?? GUARD_PALETTE[next++ % GUARD_PALETTE.length],
        sortOrder: i,
      })
    );
  }

  if (rows.length === 0) return;
  await prisma.catalogItem.createMany({
    data: rows.map((r) => ({
      organizationId,
      module: SLEEP_MODULE,
      kind: r.kind,
      nameVi: r.nameVi,
      nameZh: r.nameZh ?? null,
      code: r.code ?? null,
      color: r.color ?? null,
      sortOrder: r.sortOrder,
    })),
  });
}

// ---- Excel export: reproduces the company's sheet layout ----

const FONT = "Times New Roman";
const HEADER_FILL = "FFEBF1DE";
const THIN: Partial<ExcelJS.Border> = { style: "thin", color: { argb: "FF000000" } };
const BORDER: Partial<ExcelJS.Borders> = { top: THIN, left: THIN, bottom: THIN, right: THIN };

const COLUMNS: { header: string; width: number; align: ExcelJS.Alignment["horizontal"] }[] = [
  { header: "STT\n序号", width: 4.6, align: "center" },
  { header: "Ngày kiểm tra\n检查日期", width: 9.3, align: "center" },
  { header: "违纪时间", width: 5.6, align: "center" },
  { header: "违纪地点", width: 11, align: "center" },
  { header: "MST nhân viên vi phạm\n违规人员工号", width: 10.9, align: "center" },
  { header: "Nhà xưởng\n工厂", width: 8.7, align: "center" },
  { header: "Bộ phận\n部门", width: 10.9, align: "center" },
  { header: "Vị trí\n岗位", width: 13.9, align: "center" },
  { header: "Tên nhân viên vi phạm\n违规人员名称", width: 18.9, align: "center" },
  { header: "Số tiền khảo hạch(VND)\n考核金额", width: 12.6, align: "center" },
  { header: "Ghi chú\n备注", width: 53, align: "left" },
  { header: "MST Người chịu trách nhiệm liên đới\n连带责任人工号", width: 17.6, align: "center" },
  { header: "Tên người chịu trách nhiệm liên đới\n连带责任人名称", width: 15, align: "left" },
  { header: "Số tiền  khảo hạch(VND)\n考核金额", width: 12.6, align: "center" },
  { header: "MST bảo an kiểm tra\n检查保安的工号", width: 10.9, align: "center" },
  { header: "Tên bảo an kiểm tra\n检查保安的姓名", width: 19.4, align: "center" },
  { header: "Tiền thưởng cho bảo an\n保安奖金", width: 13.9, align: "right" },
  { header: "Ghi chú\n备注", width: 18, align: "center" },
];

function argb(hex: string | null | undefined) {
  if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return null;
  return `FF${hex.slice(1).toUpperCase()}`;
}

function codeValue(code: string | null) {
  if (!code) return null;
  return /^\d+$/.test(code) ? Number(code) : code;
}

/** Builds the monthly "夜班员工上班时间睡觉的名单" workbook: title row, bilingual header row with
 *  filters, then one row per violation — same columns, order, widths, fonts and fills as the
 *  company's own sheet, the checking guard's cell filled in that guard's color. */
export async function buildSleepViolationWorkbook(rows: SleepViolationRow[], year: number, month: number) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(`${month}月`, { views: [{ state: "frozen", ySplit: 2 }] });

  COLUMNS.forEach((c, i) => (ws.getColumn(i + 1).width = c.width));
  const lastCol = ws.getColumn(COLUMNS.length).letter;

  ws.mergeCells(`A1:${lastCol}1`);
  const title = ws.getCell("A1");
  title.value = `${month}月份夜班员工上班时间睡觉的名单`;
  title.font = { name: "SimSun", size: 20, bold: true };
  title.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 39;

  const header = ws.getRow(2);
  COLUMNS.forEach((c, i) => {
    const cell = header.getCell(i + 1);
    cell.value = c.header;
    cell.font = { name: FONT, size: 10, bold: true };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    cell.border = BORDER;
  });
  header.height = 54;
  ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: COLUMNS.length } };

  rows.forEach((r, i) => {
    const row = ws.getRow(3 + i);
    const values: ExcelJS.CellValue[] = [
      i + 1,
      r.checkDate,
      r.checkTime ?? "",
      r.location ?? "",
      codeValue(r.employeeCode),
      r.factory ?? "",
      r.department ?? "",
      r.position ?? "",
      r.employeeName,
      r.fineAmountVnd,
      r.note ?? "",
      codeValue(r.liableCode),
      r.liableName ?? "",
      r.liableFineVnd,
      codeValue(r.guardCode),
      [r.guardNameZh, r.guardNameVi].filter(Boolean).join("\n"),
      r.guardRewardVnd,
      r.remark ?? "",
    ];
    values.forEach((v, c) => {
      const cell = row.getCell(c + 1);
      cell.value = v ?? null;
      cell.font = { name: FONT, size: 10 };
      cell.alignment = { horizontal: COLUMNS[c].align, vertical: "middle", wrapText: true };
      cell.border = BORDER;
    });
    row.getCell(2).numFmt = "d/m/yyyy";
    for (const c of [10, 14, 17]) row.getCell(c).numFmt = "#,##0";
    const fill = argb(r.guardColor);
    if (fill) row.getCell(16).fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
    row.height = 37.5;
  });

  ws.pageSetup = { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: "1:2" };
  return wb;
}
