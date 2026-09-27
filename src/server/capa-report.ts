import path from "node:path";
import { promises as fs } from "node:fs";
import PptxGenJS from "pptxgenjs";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { storageService } from "@/server/storage";
import { getCapaPhotosMap } from "@/server/capa";
import { listCatalogItems, makeBilingualResolver } from "@/server/catalog";

// Geometry (inches) and colors copied from the org's own "BÁO CÁO NGUY HIỂM TIỀM ẨN" deck so the
// generated file looks like the hand-made one: green title bar, orange table header, two
// red-framed photos joined by a blue arrow.
const TEMPLATE_DIR = path.join(process.cwd(), "src/server/templates");
const LOGO_PATH = path.join(TEMPLATE_DIR, "capa-report-logo.png");
// The deck's own decorative green facets (its slide master), rendered once from the original
// .pptx at 1920x1080: cover = white page, content = beige page (EAE6DB) with the same facets.
const COVER_BG_PATH = path.join(TEMPLATE_DIR, "capa-report-bg-cover.png");
const CONTENT_BG_PATH = path.join(TEMPLATE_DIR, "capa-report-bg-content.png");
const GREEN = "90C226";
// The template's table header uses the master theme's "accent2" (Facet theme = green), not the
// default Office orange.
const TABLE_HEADER = "54A021";
const RED = "FF0000";
const BLUE = "00B0F0";

const PHOTO_BOX = { y: 1.309, w: 3.914, h: 3.071, beforeX: 1.335, afterX: 7.769 };
const TABLE = { x: 0.681, y: 4.785, colW: 1.963, headerH: 0.66, bodyH: 1.512 };

// "Phân loại vấn đề" is a fixed 6-value list (see lib/capa-constants.ts), never renamed or merged
// for this chart per explicit user decision — a bar with count 0 still shows, so the chart always
// reads as the same 6 categories issue to issue.
const CLASSIFICATION_LABELS: Record<string, { zh: string; vi: string }> = {
  hazard: { zh: "潜在危险", vi: "Nguy hiểm tiềm ẩn" },
  strict_equipment: { zh: "特种设备", vi: "Thiết bị nghiêm ngặt" },
  safety_equipment: { zh: "安全设备", vi: "Thiết bị an toàn" },
  fire_safety: { zh: "消防", vi: "PCCC" },
  electrical: { zh: "用电", vi: "Sử dụng điện" },
  environment: { zh: "环境", vi: "Môi trường" },
};
const CLASSIFICATION_ORDER = ["hazard", "strict_equipment", "safety_equipment", "fire_safety", "electrical", "environment"];
const UNCLASSIFIED_LABEL = { zh: "未分类", vi: "Chưa phân loại" };
const CHART_BLUE = "5B9BD5";
const SUMMARY_RED = "C00000";
const HEADER_LIGHT_GREEN = "C6E0B4";
const TOTAL_GREEN = "538135";

export type CapaReportItem = {
  area: string | null;
  action: string;
  improvementRequirement: string | null;
  responsibleDept: string | null;
  classification: string | null;
  discoveredDate: Date | null;
  completionDate: Date | null;
  before: Buffer | null;
  after: Buffer | null;
};

function fmtDate(d: Date | null) {
  if (!d) return "—";
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

/** Builds the "Đánh giá các vấn đề rủi ro an toàn" summary slide: a per-department count/
 *  completion-rate table, a bar chart of the 6 fixed classifications, and a short red summary
 *  paragraph — one slide covering every item in the report, not per-issue like the slides after
 *  it. The reporting period shown is simply the earliest/latest "Ngày phát hiện" among the
 *  included items — the user can hand-edit this text afterward if a different period is meant. */
function addSummarySlide(pptx: PptxGenJS, items: CapaReportItem[], contentBg: string, addLogo: (slide: PptxGenJS.Slide) => void) {
  const slide = pptx.addSlide();
  slide.background = { data: contentBg };
  addLogo(slide);

  const dates = items.map((i) => i.discoveredDate).filter((d): d is Date => d !== null);
  const minDate = dates.length ? new Date(Math.min(...dates.map((d) => d.getTime()))) : null;
  const maxDate = dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null;
  const monthYear = minDate ? { m: minDate.getUTCMonth() + 1, y: minDate.getUTCFullYear() } : { m: new Date().getUTCMonth() + 1, y: new Date().getUTCFullYear() };

  slide.addShape(pptx.ShapeType.roundRect, { x: 0.5, y: 0.32, w: 10.5, h: 0.86, fill: { color: GREEN }, line: { type: "none" }, rectRadius: 0.05 });
  slide.addText(
    [
      { text: `${monthYear.y}年${monthYear.m}月安全隐患评价检查`, options: { bold: true, fontSize: 18, breakLine: true } },
      { text: `Đánh giá các vấn đề rủi ro an toàn tháng ${monthYear.m} năm ${monthYear.y}`, options: { fontSize: 14 } },
    ],
    { x: 0.75, y: 0.32, w: 10, h: 0.86, fontFace: "Arial", color: "FFFFFF", valign: "middle", margin: 0 }
  );

  // ---- Left: count / completion table, one row per department ----
  const deptTotals = new Map<string, { zh: string; vi: string; total: number; done: number }>();
  for (const item of items) {
    const key = item.responsibleDept ?? "__none__";
    const [zh, vi] = item.responsibleDept ? item.responsibleDept.split("\n") : [UNCLASSIFIED_LABEL.zh, UNCLASSIFIED_LABEL.vi];
    const entry = deptTotals.get(key) ?? { zh, vi: vi ?? zh, total: 0, done: 0 };
    entry.total += 1;
    if (item.completionDate) entry.done += 1;
    deptTotals.set(key, entry);
  }
  const deptRows = [...deptTotals.values()].sort((a, b) => b.total - a.total);
  const grandTotal = items.length;
  const grandDone = deptRows.reduce((sum, r) => sum + r.done, 0);

  const border = { type: "solid" as const, pt: 1, color: "000000" };
  const tableHeaderCell = (zh: string, vi: string) => ({
    text: [
      { text: zh, options: { breakLine: true } },
      { text: vi },
    ],
    options: { align: "center" as const, valign: "middle" as const, fontFace: "Times New Roman", fontSize: 11, bold: true, color: "000000", fill: { color: HEADER_LIGHT_GREEN }, border, margin: [1, 3, 1, 3] as [number, number, number, number] },
  });
  const bodyCell = (text: string, opts: { bold?: boolean; color?: string; fill?: string } = {}) => ({
    text,
    options: {
      align: "center" as const,
      valign: "middle" as const,
      fontFace: "Times New Roman",
      fontSize: 11,
      bold: opts.bold ?? false,
      color: opts.color ?? "000000",
      fill: { color: opts.fill ?? "FFFFFF" },
      border,
      margin: [1, 3, 1, 3] as [number, number, number, number],
    },
  });

  const tableX = 0.5;
  const colW = [0.6, 2.5, 1.1, 1.2, 1.2];
  const headerH = 0.5;
  const totalRowH = 0.42;
  const availableBodyH = 5.0;
  const bodyRowH = Math.min(0.48, Math.max(0.26, availableBodyH / Math.max(1, deptRows.length)));

  const rows = [
    [tableHeaderCell("序号", "STT"), tableHeaderCell("科室", "BỘ PHẬN"), tableHeaderCell("问题点", "Vấn đề"), tableHeaderCell("完成", "Hoàn thành"), tableHeaderCell("比例", "Tỷ lệ")],
    ...deptRows.map((r, i) => {
      const rate = r.total > 0 ? Math.round((r.done / r.total) * 100) : 0;
      return [
        bodyCell(String(i + 1)),
        bodyCell(r.zh === r.vi ? r.zh : `${r.zh}\n${r.vi}`),
        bodyCell(String(r.total)),
        bodyCell(String(r.done)),
        bodyCell(`${rate}%`),
      ];
    }),
    [
      bodyCell("", { fill: TOTAL_GREEN }),
      bodyCell("TỔNG SỐ 合计", { bold: true, color: "FFFFFF", fill: TOTAL_GREEN }),
      bodyCell(String(grandTotal), { bold: true, color: "FFFFFF", fill: TOTAL_GREEN }),
      bodyCell(String(grandDone), { bold: true, color: "FFFFFF", fill: TOTAL_GREEN }),
      bodyCell(grandTotal > 0 ? `${Math.round((grandDone / grandTotal) * 100)}%` : "0%", { bold: true, color: "FFFFFF", fill: TOTAL_GREEN }),
    ],
  ];
  slide.addTable(rows, { x: tableX, y: 1.3, colW, rowH: [headerH, ...deptRows.map(() => bodyRowH), totalRowH] });

  // ---- Right: classification bar chart ----
  const byClassification = new Map<string, number>();
  for (const item of items) byClassification.set(item.classification ?? "__none__", (byClassification.get(item.classification ?? "__none__") ?? 0) + 1);
  const chartLabels: string[] = [];
  const chartValues: number[] = [];
  for (const key of CLASSIFICATION_ORDER) {
    chartLabels.push(CLASSIFICATION_LABELS[key].zh);
    chartValues.push(byClassification.get(key) ?? 0);
  }
  if (byClassification.has("__none__")) {
    chartLabels.push(UNCLASSIFIED_LABEL.zh);
    chartValues.push(byClassification.get("__none__")!);
  }

  const chartX = 7.35;
  const chartW = 5.5;
  slide.addChart(pptx.ChartType.bar, [{ name: "Số vấn đề", labels: chartLabels, values: chartValues }], {
    x: chartX,
    y: 1.3,
    w: chartW,
    h: 3.45,
    barDir: "col",
    chartColors: [CHART_BLUE],
    showValue: true,
    dataLabelColor: "000000",
    dataLabelFontSize: 11,
    showLegend: false,
    showTitle: true,
    title: "安全隐患问题统计\nThống kê phân loại vấn đề",
    titleFontFace: "Arial",
    titleFontSize: 13,
    titleColor: "000000",
    catAxisLabelFontSize: 9,
    valAxisHidden: true,
    valGridLine: { style: "none" },
    catAxisLineShow: true,
  });

  // ---- Right: red summary paragraph, Chinese first then Vietnamese ----
  const fmtDateCN = (d: Date) => `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日`;
  const periodCN =
    minDate && maxDate && minDate.getTime() !== maxDate.getTime()
      ? minDate.getUTCFullYear() === maxDate.getUTCFullYear() && minDate.getUTCMonth() === maxDate.getUTCMonth()
        ? `${minDate.getUTCFullYear()}年${minDate.getUTCMonth() + 1}月${minDate.getUTCDate()}日至${maxDate.getUTCDate()}日`
        : `${fmtDateCN(minDate)}至${fmtDateCN(maxDate)}`
      : minDate
        ? fmtDateCN(minDate)
        : "";
  const periodVi =
    minDate && maxDate && minDate.getTime() !== maxDate.getTime()
      ? `Từ ngày ${fmtDate(minDate)} đến ngày ${fmtDate(maxDate)}`
      : `Ngày ${fmtDate(minDate)}`;
  const unresolved = grandTotal - grandDone;
  slide.addText(
    [
      { text: `${periodCN}，安全环保部组织开展安全隐患排查检查，共发现` },
      { text: String(grandTotal), options: { bold: true } },
      { text: "个问题，其中" },
      { text: String(unresolved), options: { bold: true } },
      { text: "个问题尚未整改，目前已完成" },
      { text: String(grandDone), options: { bold: true } },
      { text: "个问题。", options: { breakLine: true } },
      { text: `${periodVi}, Phòng An toàn - Môi trường tổ chức đánh giá và kiểm tra các mối nguy tiềm ẩn về an toàn, phát hiện ` },
      { text: String(grandTotal), options: { bold: true } },
      { text: " vấn đề phát sinh, trong đó " },
      { text: String(unresolved), options: { bold: true } },
      { text: " vấn đề vẫn chưa được cải thiện, hiện tại có " },
      { text: String(grandDone), options: { bold: true } },
      { text: " vấn đề đã hoàn thành." },
    ],
    { x: chartX, y: 4.95, w: chartW, h: 2.1, fontFace: "Arial", fontSize: 11, color: SUMMARY_RED, valign: "top", lineSpacingMultiple: 1.15 }
  );
}

/** Long free text must still fit the fixed-height cell — step the font down with the length. */
function fontSizeFor(text: string) {
  const len = text.length;
  if (len <= 70) return 12;
  if (len <= 110) return 10;
  if (len <= 170) return 9;
  return 8;
}

/** Embeds a photo as a JPEG sized to fit inside its frame (aspect preserved, centered) — PowerPoint
 *  has no reliable WebP support, and the stored file could be any of the allowed image types. */
async function fitPhoto(buffer: Buffer, boxX: number, boxW: number) {
  const jpeg = await sharp(buffer).rotate().flatten({ background: "#ffffff" }).resize(1400, 1100, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
  const meta = await sharp(jpeg).metadata();
  const pxW = meta.width ?? 1;
  const pxH = meta.height ?? 1;
  const scale = Math.min(boxW / pxW, PHOTO_BOX.h / pxH);
  const w = pxW * scale;
  const h = pxH * scale;
  return { data: `image/jpeg;base64,${jpeg.toString("base64")}`, x: boxX + (boxW - w) / 2, y: PHOTO_BOX.y + (PHOTO_BOX.h - h) / 2, w, h };
}

export async function buildCapaReport(params: { items: CapaReportItem[]; reporterName: string }): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE"; // 13.333 x 7.5 in — same 16:9 size as the original deck
  pptx.title = "BÁO CÁO NGUY HIỂM TIỀM ẨN";

  const asPng = async (file: string) => `image/png;base64,${(await fs.readFile(file)).toString("base64")}`;
  const [logoData, coverBg, contentBg] = await Promise.all([asPng(LOGO_PATH), asPng(COVER_BG_PATH), asPng(CONTENT_BG_PATH)]);
  const addLogo = (slide: PptxGenJS.Slide) => slide.addImage({ data: logoData, x: 11.15, y: 0.3, w: 1.75, h: 0.302 });

  // ---- Cover ----
  const cover = pptx.addSlide();
  cover.background = { data: coverBg };
  addLogo(cover);
  cover.addText(
    [
      { text: "潜在危险报告", options: { breakLine: true } },
      { text: "BÁO CÁO NGUY HIỂM TIỀM ẨN" },
    ],
    { x: 0.8, y: 0.837, w: 11.5, h: 3.4, fontFace: "Arial", fontSize: 40, bold: true, color: "000000", valign: "middle", lineSpacingMultiple: 1.12 }
  );
  cover.addText("CCGrass  ·  Phòng An toàn - Môi trường  安环科", { x: 0.8, y: 4.616, w: 11.5, h: 0.5, fontFace: "Arial", fontSize: 16, color: "000000", valign: "middle" });
  cover.addText(`报告人：${params.reporterName}`, { x: 0.8, y: 5.2, w: 8, h: 0.45, fontFace: "Arial", fontSize: 18, color: "000000", valign: "middle" });

  // ---- Slide 2: department count/completion summary + classification chart ----
  if (params.items.length > 0) addSummarySlide(pptx, params.items, contentBg, addLogo);

  // ---- One slide per issue ----
  for (const item of params.items) {
    const slide = pptx.addSlide();
    slide.background = { data: contentBg };
    addLogo(slide);

    slide.addShape(pptx.ShapeType.roundRect, { x: 0.5, y: 0.32, w: 7.9, h: 0.86, fill: { color: GREEN }, line: { type: "none" }, rectRadius: 0.07 });
    slide.addText(
      [
        { text: "二、潜在危险", options: { bold: true, fontSize: 18, breakLine: true } },
        { text: "Mục II. Nguy hiểm tiềm ẩn", options: { fontSize: 14 } },
      ],
      { x: 0.75, y: 0.32, w: 7.5, h: 0.86, fontFace: "Arial", color: "FFFFFF", valign: "middle", margin: 0 }
    );

    for (const [photo, boxX] of [
      [item.before, PHOTO_BOX.beforeX],
      [item.after, PHOTO_BOX.afterX],
    ] as const) {
      slide.addShape(pptx.ShapeType.rect, { x: boxX, y: PHOTO_BOX.y, w: PHOTO_BOX.w, h: PHOTO_BOX.h, fill: { color: photo ? "FFFFFF" : "F2F2F2" }, line: { color: RED, width: 2 } });
      if (photo) {
        const placed = await fitPhoto(photo, boxX, PHOTO_BOX.w);
        slide.addImage({ data: placed.data, x: placed.x, y: placed.y, w: placed.w, h: placed.h });
      } else {
        slide.addText([{ text: "暂无照片", options: { breakLine: true } }, { text: "Chưa có ảnh" }], {
          x: boxX, y: PHOTO_BOX.y, w: PHOTO_BOX.w, h: PHOTO_BOX.h, align: "center", valign: "middle", fontFace: "Arial", fontSize: 16, color: "7F7F7F",
        });
      }
    }

    slide.addShape(pptx.ShapeType.rightArrow, { x: 5.721, y: 2.726, w: 1.575, h: 0.382, fill: { color: BLUE }, line: { color: BLUE, width: 2 } });
    slide.addText(
      [
        { text: "整改后 ", options: { breakLine: true } },
        { text: "Sau cải thiện" },
      ],
      { x: 5.56, y: 2.018, w: 1.742, h: 0.706, align: "center", valign: "middle", fontFace: "Arial", fontSize: 18, bold: true, color: "000000", margin: 0 }
    );

    const border = { type: "solid" as const, pt: 1, color: "000000" };
    const headerCell = (zh: string, vi: string) => ({
      text: [
        { text: zh, options: { breakLine: true } },
        { text: vi },
      ],
      options: { align: "center" as const, valign: "middle" as const, fontFace: "Times New Roman", fontSize: 12, color: "000000", fill: { color: TABLE_HEADER }, border, margin: [2, 4, 2, 4] as [number, number, number, number] },
    });
    const bodyCell = (text: string) => ({
      text,
      options: { align: "center" as const, valign: "middle" as const, fontFace: "Times New Roman", fontSize: fontSizeFor(text), color: "000000", fill: { color: "FFFFFF" }, border, margin: [3, 4, 3, 4] as [number, number, number, number] },
    });

    slide.addTable(
      [
        [
          headerCell("位置", "VỊ TRÍ"),
          headerCell("现状", "HIỆN TRẠNG"),
          headerCell("整改要求", "YÊU CẦU CẢI THIỆN"),
          headerCell("责任部门", "BP CHỊU TRÁCH NHIỆM"),
          headerCell("提出时间", "THỜI GIAN PHÁT SINH"),
          headerCell("整改时间", "THỜI GIAN CẢI CHÍNH"),
        ],
        [
          bodyCell(item.area || "—"),
          bodyCell(item.action),
          bodyCell(item.improvementRequirement || "—"),
          bodyCell(item.responsibleDept || "—"),
          bodyCell(fmtDate(item.discoveredDate)),
          bodyCell(item.completionDate ? fmtDate(item.completionDate) : "未完成\nChưa hoàn thành"),
        ],
      ],
      { x: TABLE.x, y: TABLE.y, colW: Array(6).fill(TABLE.colW), rowH: [TABLE.headerH, TABLE.bodyH] }
    );
  }

  const out = await pptx.write({ outputType: "nodebuffer" });
  return out as Buffer;
}

/** Loads the requested CAPA rows (scoped to the org — ids from another tenant are silently
 *  dropped), resolves area/department to "Chinese + Vietnamese" via the workshop catalog, and
 *  pulls each row's before/after photo bytes from storage. Keeps the caller's id order. */
export async function loadCapaReportItems(organizationId: string, ids: string[]): Promise<CapaReportItem[]> {
  const [rows, areaItems, deptItems, photos] = await Promise.all([
    prisma.capaItem.findMany({ where: { organizationId, id: { in: ids } } }),
    listCatalogItems(organizationId, "capa", "area"),
    listCatalogItems(organizationId, "capa", "dept"),
    getCapaPhotosMap(organizationId, ids),
  ]);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const bilingualArea = makeBilingualResolver(areaItems);
  const bilingualDept = makeBilingualResolver(deptItems);

  const readPhoto = async (doc: { id: string } | null) => {
    if (!doc) return null;
    const meta = await prisma.document.findUnique({ where: { id: doc.id }, select: { storagePath: true, organizationId: true } });
    if (!meta || meta.organizationId !== organizationId) return null;
    return storageService.read(meta.storagePath).catch(() => null);
  };

  const items: CapaReportItem[] = [];
  for (const id of ids) {
    const row = byId.get(id);
    if (!row) continue;
    const p = photos.get(id) ?? { before: null, after: null };
    items.push({
      area: bilingualArea(row.area),
      action: row.action,
      improvementRequirement: row.improvementRequirement,
      responsibleDept: bilingualDept(row.responsibleDept),
      classification: row.classification,
      discoveredDate: row.discoveredDate ?? row.createdAt,
      completionDate: row.completionDate,
      before: await readPhoto(p.before),
      after: await readPhoto(p.after),
    });
  }
  return items;
}
