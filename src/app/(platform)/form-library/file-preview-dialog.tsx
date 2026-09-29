"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import type { Cell, Worksheet } from "exceljs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/locale-context";
import { extensionOf, type FormFileDto } from "@/lib/form-files";

type PreviewKind = "pdf" | "image" | "docx" | "xlsx";

const IMAGE_EXTS = ["png", "jpg", "jpeg", "webp", "gif"];

/** Which in-page viewer can show this file, or null when it can only be downloaded (old binary
 *  .doc/.xls and PowerPoint have no browser-side renderer). */
export function previewKind(fileName: string): PreviewKind | null {
  const ext = extensionOf(fileName);
  if (ext === "pdf") return "pdf";
  if (IMAGE_EXTS.includes(ext)) return "image";
  if (ext === "docx") return "docx";
  if (ext === "xlsx") return "xlsx";
  return null;
}

/** Quick look at a form-library file without downloading it. Word/Excel are rendered entirely in
 *  the viewer's own browser (the file is fetched from our own authenticated route, never sent to
 *  any outside viewer service), and both renderers are loaded only when a preview is opened. */
export function FilePreviewDialog({ file, onOpenChange }: { file: FormFileDto | null; onOpenChange: (open: boolean) => void }) {
  const t = useT();
  const kind = file ? previewKind(file.fileName) : null;
  const href = file ? `/api/forms/files/${file.id}` : "";

  return (
    <Dialog open={file !== null} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[92vh] flex-col gap-3 sm:max-w-6xl">
        <DialogHeader className="pr-10">
          <DialogTitle className="flex flex-wrap items-center gap-3 leading-snug">
            <span className="min-w-0 flex-1 break-words">{file?.fileName}</span>
            {file && (
              <a href={`${href}?download=1`} className={buttonVariants({ variant: "default", size: "sm" })}>
                <Download className="size-4" />
                {t("forms.download")}
              </a>
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-hidden rounded-lg border bg-muted/40">
          {file && kind === "pdf" && <iframe src={href} title={file.fileName} className="size-full bg-white" />}
          {file && kind === "image" && (
            <div className="flex size-full items-center justify-center overflow-auto p-4">
              {/* eslint-disable-next-line @next/next/no-img-element -- authenticated API route, not a static asset */}
              <img src={href} alt={file.fileName} className="max-h-full max-w-full object-contain" />
            </div>
          )}
          {file && (kind === "docx" || kind === "xlsx") && <OfficePreview key={file.id} href={href} kind={kind} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function OfficePreview({ href, kind }: { href: string; kind: "docx" | "xlsx" }) {
  const t = useT();
  const docxRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [sheets, setSheets] = useState<SheetView[]>([]);
  const [activeSheet, setActiveSheet] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(href);
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.arrayBuffer();
        if (cancelled) return;
        if (kind === "docx") {
          const { renderAsync } = await import("docx-preview");
          if (cancelled || !docxRef.current) return;
          await renderAsync(data, docxRef.current, undefined, { inWrapper: true, breakPages: true, ignoreLastRenderedPageBreak: true });
        } else {
          const ExcelJS = (await import("exceljs")).default;
          const workbook = new ExcelJS.Workbook();
          await workbook.xlsx.load(data);
          if (cancelled) return;
          setSheets(workbook.worksheets.filter((ws) => ws.state !== "hidden" && ws.state !== "veryHidden").map(toSheetView));
        }
        if (!cancelled) setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [href, kind]);

  const sheet = sheets[activeSheet];

  return (
    <div className="relative flex size-full flex-col">
      {status === "loading" && (
        <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          {t("forms.previewLoading")}
        </div>
      )}
      {status === "error" && <div className="flex size-full items-center justify-center p-6 text-center text-sm text-muted-foreground">{t("forms.previewError")}</div>}

      {kind === "docx" && <div ref={docxRef} className={cn("docx-preview-host min-h-0 flex-1 overflow-auto", status === "error" && "hidden")} />}

      {kind === "xlsx" && status === "ready" && (
        <>
          {sheets.length > 1 && (
            <div className="flex shrink-0 gap-1 overflow-x-auto border-b bg-card p-1.5">
              {sheets.map((s, i) => (
                <button
                  key={s.name + i}
                  type="button"
                  onClick={() => setActiveSheet(i)}
                  className={cn("shrink-0 rounded-md px-3 py-1 text-xs font-medium", i === activeSheet ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-auto bg-white p-3 text-black">
            {sheet && sheet.rows.length > 0 ? <SheetTable sheet={sheet} /> : <p className="p-6 text-center text-sm text-neutral-500">{t("forms.previewEmptySheet")}</p>}
            {sheet?.truncated && <p className="pt-2 text-xs text-neutral-500">{t("forms.previewTruncated")}</p>}
          </div>
        </>
      )}
    </div>
  );
}

// ---- Excel → plain HTML table (values, merged cells, bold, alignment, column widths) ----

const MAX_ROWS = 500;
const MAX_COLS = 60;

type SheetCell = { text: string; rowSpan: number; colSpan: number; bold: boolean; align?: "left" | "center" | "right" } | null;
type SheetView = { name: string; widths: number[]; rows: SheetCell[][]; truncated: boolean };

function columnNumber(letters: string) {
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

function parseRef(ref: string) {
  const m = /^([A-Z]+)(\d+)$/.exec(ref);
  return m ? { col: columnNumber(m[1]), row: Number(m[2]) } : null;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** exceljs gives date cells back as a JS Date whose `.text` is the long English toString() —
 *  show them the way Excel does here instead (Excel dates carry no zone, exceljs reads them as UTC). */
function cellText(cell: Cell) {
  const value = cell.value;
  if (value instanceof Date) {
    const date = `${pad(value.getUTCDate())}/${pad(value.getUTCMonth() + 1)}/${value.getUTCFullYear()}`;
    return /h/i.test(cell.numFmt ?? "") ? `${date} ${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}` : date;
  }
  return cell.text ?? "";
}

function toSheetView(ws: Worksheet): SheetView {
  // "B2:D3" merges → the top-left cell spans, every other covered cell is skipped (null).
  const spans = new Map<string, { rowSpan: number; colSpan: number }>();
  const covered = new Set<string>();
  const merges = ((ws.model as unknown as { merges?: string[] }).merges ?? []) as string[];
  let lastRow = 0;
  let lastCol = 0;
  for (const range of merges) {
    const [a, b] = range.split(":");
    const start = parseRef(a);
    const end = parseRef(b ?? a);
    if (!start || !end) continue;
    spans.set(`${start.row}:${start.col}`, { rowSpan: end.row - start.row + 1, colSpan: end.col - start.col + 1 });
    for (let r = start.row; r <= end.row; r++) for (let c = start.col; c <= end.col; c++) if (r !== start.row || c !== start.col) covered.add(`${r}:${c}`);
  }

  // Sheets often carry formatting on thousands of blank rows/columns — only show up to the last
  // cell that actually has a value.
  ws.eachRow((row, r) => {
    row.eachCell((cell, c) => {
      if (cell.text?.trim()) {
        lastRow = Math.max(lastRow, r);
        lastCol = Math.max(lastCol, c);
      }
    });
  });
  const rowCount = Math.min(lastRow, MAX_ROWS);
  const colCount = Math.min(lastCol, MAX_COLS);

  const rows: SheetCell[][] = [];
  for (let r = 1; r <= rowCount; r++) {
    const row = ws.getRow(r);
    const cells: SheetCell[] = [];
    for (let c = 1; c <= colCount; c++) {
      if (covered.has(`${r}:${c}`)) {
        cells.push(null);
        continue;
      }
      const cell = row.getCell(c);
      const span = spans.get(`${r}:${c}`);
      const horizontal = cell.alignment?.horizontal;
      cells.push({
        text: cellText(cell),
        rowSpan: Math.min(span?.rowSpan ?? 1, rowCount - r + 1),
        colSpan: Math.min(span?.colSpan ?? 1, colCount - c + 1),
        bold: Boolean(cell.font?.bold),
        align: horizontal === "center" || horizontal === "centerContinuous" ? "center" : horizontal === "right" ? "right" : horizontal === "left" ? "left" : undefined,
      });
    }
    rows.push(cells);
  }

  const widths = Array.from({ length: colCount }, (_, i) => Math.round((ws.getColumn(i + 1).width ?? 10) * 7.5));
  return { name: ws.name, widths, rows, truncated: lastRow > MAX_ROWS || lastCol > MAX_COLS };
}

function SheetTable({ sheet }: { sheet: SheetView }) {
  return (
    <table className="border-collapse text-xs">
      <colgroup>
        {sheet.widths.map((w, i) => (
          <col key={i} style={{ width: w, minWidth: w }} />
        ))}
      </colgroup>
      <tbody>
        {sheet.rows.map((cells, r) => (
          <tr key={r}>
            {cells.map((cell, c) =>
              cell === null ? null : (
                <td
                  key={c}
                  rowSpan={cell.rowSpan > 1 ? cell.rowSpan : undefined}
                  colSpan={cell.colSpan > 1 ? cell.colSpan : undefined}
                  className={cn("border border-neutral-300 px-1.5 py-1 align-middle whitespace-pre-wrap", cell.bold && "font-semibold")}
                  style={cell.align ? { textAlign: cell.align } : undefined}
                >
                  {cell.text}
                </td>
              )
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
