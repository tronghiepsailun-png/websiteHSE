"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, MoveUpRight, Pencil, RotateCw, Square, Trash2, Type, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/locale-context";
import type { DictionaryKey } from "@/lib/i18n/translate";

// Phone photos are 12MP+; editing and re-encoding at this size keeps the canvas fast while the
// result stays sharp enough for a printed/PowerPoint report.
const MAX_SIDE = 1600;

type Tool = "rect" | "arrow" | "pen" | "text";
type Point = { x: number; y: number };
type Shape =
  | { kind: "rect"; a: Point; b: Point; color: string; size: number }
  | { kind: "arrow"; a: Point; b: Point; color: string; size: number }
  | { kind: "pen"; pts: Point[]; color: string; size: number }
  | { kind: "text"; at: Point; text: string; color: string; size: number };

const COLORS: { value: string; labelKey: DictionaryKey }[] = [
  { value: "#ff0000", labelKey: "photo.color.red" },
  { value: "#facc15", labelKey: "photo.color.yellow" },
  { value: "#00b0f0", labelKey: "photo.color.blue" },
];
const SIZES: { value: number; labelKey: DictionaryKey }[] = [
  { value: 0.6, labelKey: "photo.size.thin" },
  { value: 1, labelKey: "photo.size.medium" },
  { value: 1.8, labelKey: "photo.size.thick" },
];

async function decodeImage(file: File): Promise<HTMLCanvasElement> {
  let source: CanvasImageSource;
  let width: number;
  let height: number;
  try {
    // "from-image" applies the camera's EXIF rotation, so a portrait phone photo isn't sideways.
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    source = bitmap;
    width = bitmap.width;
    height = bitmap.height;
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      source = img;
      width = img.naturalWidth;
      height = img.naturalHeight;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff"; // transparent PNG/GIF areas become white instead of black in the JPEG
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function drawShape(ctx: CanvasRenderingContext2D, shape: Shape, unit: number) {
  const lw = Math.max(2, unit * shape.size);
  ctx.strokeStyle = shape.color;
  ctx.fillStyle = shape.color;
  ctx.lineWidth = lw;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (shape.kind === "rect") {
    ctx.strokeRect(shape.a.x, shape.a.y, shape.b.x - shape.a.x, shape.b.y - shape.a.y);
  } else if (shape.kind === "arrow") {
    const { a, b } = shape;
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    const head = lw * 4.5;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x - Math.cos(angle) * head * 0.6, b.y - Math.sin(angle) * head * 0.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - head * Math.cos(angle - Math.PI / 7), b.y - head * Math.sin(angle - Math.PI / 7));
    ctx.lineTo(b.x - head * Math.cos(angle + Math.PI / 7), b.y - head * Math.sin(angle + Math.PI / 7));
    ctx.closePath();
    ctx.fill();
  } else if (shape.kind === "pen") {
    if (shape.pts.length === 0) return;
    ctx.beginPath();
    ctx.moveTo(shape.pts[0].x, shape.pts[0].y);
    for (const p of shape.pts.slice(1)) ctx.lineTo(p.x, p.y);
    if (shape.pts.length === 1) ctx.lineTo(shape.pts[0].x + 0.1, shape.pts[0].y);
    ctx.stroke();
  } else {
    ctx.font = `bold ${Math.round(unit * 3.4 * shape.size + 14)}px Arial, sans-serif`;
    ctx.textBaseline = "top";
    ctx.lineWidth = Math.max(2, unit * 0.45);
    ctx.strokeStyle = "rgba(0,0,0,0.55)"; // thin dark outline keeps the text readable on any photo
    ctx.strokeText(shape.text, shape.at.x, shape.at.y);
    ctx.fillText(shape.text, shape.at.x, shape.at.y);
  }
}

function rotatePoint(p: Point, oldHeight: number): Point {
  return { x: oldHeight - p.y, y: p.x };
}

function rotateShape(shape: Shape, oldHeight: number): Shape {
  if (shape.kind === "pen") return { ...shape, pts: shape.pts.map((p) => rotatePoint(p, oldHeight)) };
  if (shape.kind === "text") return { ...shape, at: rotatePoint(shape.at, oldHeight) };
  return { ...shape, a: rotatePoint(shape.a, oldHeight), b: rotatePoint(shape.b, oldHeight) };
}

function Editor({ file, onConfirm, onCancel }: { file: File; onConfirm: (result: File) => void; onCancel: () => void }) {
  const t = useT();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [base, setBase] = useState<HTMLCanvasElement | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [draft, setDraft] = useState<Shape | null>(null);
  const [tool, setTool] = useState<Tool>("rect");
  const [color, setColor] = useState(COLORS[0].value);
  const [size, setSize] = useState(1);
  const [textDraft, setTextDraft] = useState<{ at: Point; value: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    decodeImage(file).then(
      (canvas) => !cancelled && setBase(canvas),
      () => !cancelled && setLoadError(true)
    );
    return () => {
      cancelled = true;
    };
  }, [file]);

  // Stroke scale follows the image size, so a "medium" line is ~1% of the long side — still
  // clearly visible once the photo is shrunk into a report slide or a table thumbnail.
  const unit = base ? Math.max(base.width, base.height) / 150 : 1;

  const textInputRef = useRef<HTMLInputElement>(null);
  const hasTextDraft = textDraft !== null;
  useEffect(() => {
    if (!hasTextDraft) return;
    const frame = requestAnimationFrame(() => textInputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [hasTextDraft]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !base) return;
    canvas.width = base.width;
    canvas.height = base.height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(base, 0, 0);
    for (const s of shapes) drawShape(ctx, s, unit);
    if (draft) drawShape(ctx, draft, unit);
  }, [base, shapes, draft, unit]);

  const toImagePoint = useCallback((e: React.PointerEvent): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * canvas.width, y: ((e.clientY - rect.top) / rect.height) * canvas.height };
  }, []);

  function commitText() {
    if (textDraft && textDraft.value.trim()) {
      setShapes((prev) => [...prev, { kind: "text", at: textDraft.at, text: textDraft.value.trim(), color, size }]);
    }
    setTextDraft(null);
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!base) return;
    const p = toImagePoint(e);
    if (tool === "text") {
      // Keeps the browser's own mousedown focus handling from immediately blurring the input
      // that is about to appear (which would commit an empty label and remove it again).
      e.preventDefault();
      commitText();
      setTextDraft({ at: p, value: "" });
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    setDraft(
      tool === "pen"
        ? { kind: "pen", pts: [p], color, size }
        : tool === "rect"
          ? { kind: "rect", a: p, b: p, color, size }
          : { kind: "arrow", a: p, b: p, color, size }
    );
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!draft) return;
    const p = toImagePoint(e);
    setDraft(draft.kind === "pen" ? { ...draft, pts: [...draft.pts, p] } : draft.kind === "text" ? draft : { ...draft, b: p });
  }

  function onPointerUp() {
    if (!draft) return;
    const tiny = draft.kind === "rect" || draft.kind === "arrow" ? Math.hypot(draft.b.x - draft.a.x, draft.b.y - draft.a.y) < unit * 2 : false;
    if (!tiny) setShapes((prev) => [...prev, draft]);
    setDraft(null);
  }

  function rotate() {
    if (!base) return;
    commitText();
    const rotated = document.createElement("canvas");
    rotated.width = base.height;
    rotated.height = base.width;
    const ctx = rotated.getContext("2d")!;
    ctx.translate(rotated.width, 0);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(base, 0, 0);
    setShapes((prev) => prev.map((s) => rotateShape(s, base.height)));
    setBase(rotated);
  }

  function confirm() {
    commitText();
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const baseName = file.name.replace(/\.[^.]+$/, "") || "photo";
        onConfirm(new File([blob], `${baseName}.jpg`, { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.88
    );
  }

  const toolButton = (value: Tool, icon: React.ReactNode, labelKey: DictionaryKey) => (
    <Button type="button" size="sm" variant={tool === value ? "default" : "outline"} onClick={() => (commitText(), setTool(value))} aria-pressed={tool === value}>
      {icon}
      <span className="hidden sm:inline">{t(labelKey)}</span>
    </Button>
  );

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {toolButton("rect", <Square className="size-4" />, "photo.tool.rect")}
        {toolButton("arrow", <MoveUpRight className="size-4" />, "photo.tool.arrow")}
        {toolButton("pen", <Pencil className="size-4" />, "photo.tool.pen")}
        {toolButton("text", <Type className="size-4" />, "photo.tool.text")}
        <span className="mx-1 h-6 w-px bg-border" />
        <div className="flex items-center gap-1.5" role="group" aria-label={t("photo.color.label")}>
          {COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              aria-label={t(c.labelKey)}
              aria-pressed={color === c.value}
              onClick={() => setColor(c.value)}
              className={cn("size-6 rounded-full border-2 transition-transform", color === c.value ? "scale-110 border-foreground" : "border-transparent")}
              style={{ backgroundColor: c.value }}
            />
          ))}
        </div>
        <div className="flex items-center gap-1" role="group" aria-label={t("photo.size.label")}>
          {SIZES.map((s) => (
            <Button key={s.value} type="button" size="sm" variant={size === s.value ? "secondary" : "ghost"} onClick={() => setSize(s.value)} aria-pressed={size === s.value}>
              {t(s.labelKey)}
            </Button>
          ))}
        </div>
        <span className="ml-auto flex items-center gap-1">
          <Button type="button" size="sm" variant="ghost" disabled={shapes.length === 0} onClick={() => setShapes((prev) => prev.slice(0, -1))}>
            <Undo2 className="size-4" />
            <span className="hidden sm:inline">{t("photo.tool.undo")}</span>
          </Button>
          <Button type="button" size="sm" variant="ghost" disabled={shapes.length === 0} onClick={() => setShapes([])}>
            <Trash2 className="size-4" />
            <span className="hidden sm:inline">{t("photo.tool.clear")}</span>
          </Button>
          <Button type="button" size="sm" variant="ghost" disabled={!base} onClick={rotate}>
            <RotateCw className="size-4" />
            <span className="hidden sm:inline">{t("photo.tool.rotate")}</span>
          </Button>
        </span>
      </div>

      <div className="flex max-h-[62vh] min-h-40 items-center justify-center overflow-auto rounded-lg bg-muted p-2">
        {loadError ? (
          <p className="text-sm text-destructive">{t("photo.editor.error")}</p>
        ) : !base ? (
          <p className="text-sm text-muted-foreground">{t("photo.editor.loading")}</p>
        ) : (
          <div className="relative inline-block max-w-full">
            <canvas
              ref={canvasRef}
              className={cn("block max-h-[58vh] max-w-full touch-none select-none rounded", tool === "text" ? "cursor-text" : "cursor-crosshair")}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            />
            {textDraft && (
              <input
                ref={textInputRef}
                value={textDraft.value}
                onChange={(e) => setTextDraft({ ...textDraft, value: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitText();
                  if (e.key === "Escape") setTextDraft(null);
                }}
                onBlur={commitText}
                placeholder={t("photo.textPlaceholder")}
                className="absolute z-10 w-40 rounded border bg-background px-1.5 py-0.5 text-sm"
                style={{ left: `${(textDraft.at.x / base.width) * 100}%`, top: `${(textDraft.at.y / base.height) * 100}%` }}
              />
            )}
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">{t("photo.editor.hint")}</p>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button type="button" onClick={confirm} disabled={!base}>
          <Check className="size-4" />
          {t("photo.editor.confirm")}
        </Button>
      </DialogFooter>
    </>
  );
}

/** Lets the user mark up a photo (red boxes, arrows, freehand, text) before it is attached. The
 *  edit happens entirely in the browser; `onConfirm` gets the flattened JPEG, and nothing reaches
 *  the server until whatever form owns the file actually submits. */
export function PhotoAnnotatorDialog({ file, onConfirm, onCancel }: { file: File | null; onConfirm: (result: File) => void; onCancel: () => void }) {
  const t = useT();
  return (
    <Dialog open={file !== null} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{t("photo.editor.title")}</DialogTitle>
        </DialogHeader>
        {file && <Editor file={file} onConfirm={onConfirm} onCancel={onCancel} />}
      </DialogContent>
    </Dialog>
  );
}
