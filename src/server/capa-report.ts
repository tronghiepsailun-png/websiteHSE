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
const LOGO_PATH = path.join(process.cwd(), "src/server/templates/capa-report-logo.png");
const GREEN = "90C226";
const ORANGE = "ED7D31";
const BEIGE = "EAE6DB";
const RED = "FF0000";
const BLUE = "00B0F0";

const PHOTO_BOX = { y: 1.309, w: 3.914, h: 3.071, beforeX: 1.335, afterX: 7.769 };
const TABLE = { x: 0.681, y: 4.785, colW: 1.963, headerH: 0.66, bodyH: 1.512 };

export type CapaReportItem = {
  area: string | null;
  action: string;
  improvementRequirement: string | null;
  responsibleDept: string | null;
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

  const logo = await fs.readFile(LOGO_PATH);
  const logoData = `image/png;base64,${logo.toString("base64")}`;
  const addLogo = (slide: PptxGenJS.Slide) => slide.addImage({ data: logoData, x: 11.15, y: 0.3, w: 1.75, h: 0.302 });

  // ---- Cover ----
  const cover = pptx.addSlide();
  cover.background = { color: "FFFFFF" };
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

  // ---- One slide per issue ----
  for (const item of params.items) {
    const slide = pptx.addSlide();
    slide.background = { color: BEIGE };
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
      options: { align: "center" as const, valign: "middle" as const, fontFace: "Times New Roman", fontSize: 12, color: "000000", fill: { color: ORANGE }, border, margin: [2, 4, 2, 4] as [number, number, number, number] },
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
      discoveredDate: row.discoveredDate ?? row.createdAt,
      completionDate: row.completionDate,
      before: await readPhoto(p.before),
      after: await readPhoto(p.after),
    });
  }
  return items;
}
