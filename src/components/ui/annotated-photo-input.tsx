"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/locale-context";
import { PhotoAnnotatorDialog } from "@/components/ui/photo-annotator-dialog";

/** First image in a drop/paste payload. Pasted screenshots and images copied from chat apps
 *  (Zalo, Messenger...) arrive with an empty or generic name, so give them a real one. */
function imageFrom(data: DataTransfer | null): File | null {
  if (!data) return null;
  const file = Array.from(data.files).find((f) => f.type.startsWith("image/")) ?? Array.from(data.items).find((i) => i.kind === "file" && i.type.startsWith("image/"))?.getAsFile();
  if (!file) return null;
  if (file.name && file.name !== "image.png") return file;
  const ext = file.type.split("/")[1] || "png";
  return new File([file], `anh-${Date.now()}.${ext}`, { type: file.type });
}

/** Drop-in photo picker for a form: choosing an image opens the annotation editor first, and the
 *  edited image (not the original file) is what the form submits under `name`. Like FileInput,
 *  the visible label is rendered by us so it follows the app's language, not the browser's.
 *  Besides clicking, an image can be dragged onto the box (from the desktop, File Explorer, a
 *  browser) or pasted with Ctrl+V while the box is hovered/focused (screenshots, images copied
 *  in Zalo) — both go through the same annotation step. */
export function AnnotatedPhotoInput({ name, formId, accept, className }: { name: string; formId?: string; accept?: string; className?: string }) {
  const t = useT();
  const pickerRef = useRef<HTMLInputElement>(null);
  const submitRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState<File | null>(null);
  const [result, setResult] = useState<{ file: File; url: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const urlRef = useRef<string | null>(null);

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    []
  );

  // Ctrl+V targets whatever has focus, and a plain box rarely does — so listen on the document
  // and only take the image while the pointer is over this box or focus is inside it.
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const box = boxRef.current;
      if (!box || editing) return;
      if (!box.matches(":hover") && !box.contains(document.activeElement)) return;
      const file = imageFrom(e.clipboardData);
      if (!file) return;
      e.preventDefault();
      setEditing(file);
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [editing]);

  function apply(file: File) {
    if (submitRef.current) {
      // The real, submitting <input type="file"> — filled programmatically with the edited image.
      const transfer = new DataTransfer();
      transfer.items.add(file);
      submitRef.current.files = transfer.files;
    }
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    const url = URL.createObjectURL(file);
    urlRef.current = url;
    setResult({ file, url });
    setEditing(null);
  }

  return (
    <>
      <input ref={submitRef} name={name} form={formId} type="file" className="hidden" tabIndex={-1} aria-hidden />
      <input
        ref={pickerRef}
        type="file"
        accept={accept}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) setEditing(file);
        }}
      />
      <div
        ref={boxRef}
        onDragOver={(e) => {
          if (!Array.from(e.dataTransfer.types).includes("Files")) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = imageFrom(e.dataTransfer);
          if (file) setEditing(file);
        }}
        className={cn(
          "flex h-8 items-center rounded-lg border border-input bg-transparent transition-colors dark:bg-input/30",
          dragOver && "border-primary bg-primary/10 ring-3 ring-primary/30",
          className
        )}
        title={t("photo.dropHint")}
      >
        <button
          type="button"
          onClick={() => pickerRef.current?.click()}
          className="flex h-full min-w-0 flex-1 cursor-pointer items-center gap-1.5 truncate rounded-lg px-2.5 text-sm hover:bg-muted/50"
        >
          {result ? (
            // eslint-disable-next-line @next/next/no-img-element -- local blob preview, not an optimizable asset
            <img src={result.url} alt="" className="size-5 shrink-0 rounded object-cover" />
          ) : (
            <Upload className="size-3.5 shrink-0 text-muted-foreground" />
          )}
          <span className={cn("truncate", result ? "text-foreground" : "text-muted-foreground")}>
            {dragOver ? t("photo.dropHere") : result ? t("photo.edited") : t("photo.pickOrDrop")}
          </span>
        </button>
        {result && (
          <button
            type="button"
            onClick={() => setEditing(result.file)}
            className="flex h-full shrink-0 items-center rounded-lg px-2 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            aria-label={t("photo.editAgain")}
            title={t("photo.editAgain")}
          >
            <Pencil className="size-3.5" />
          </button>
        )}
      </div>
      <PhotoAnnotatorDialog file={editing} onConfirm={apply} onCancel={() => setEditing(null)} />
    </>
  );
}
