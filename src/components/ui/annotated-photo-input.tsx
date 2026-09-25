"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/locale-context";
import { PhotoAnnotatorDialog } from "@/components/ui/photo-annotator-dialog";

/** Drop-in photo picker for a form: choosing an image opens the annotation editor first, and the
 *  edited image (not the original file) is what the form submits under `name`. Like FileInput,
 *  the visible label is rendered by us so it follows the app's language, not the browser's. */
export function AnnotatedPhotoInput({ name, formId, accept, className }: { name: string; formId?: string; accept?: string; className?: string }) {
  const t = useT();
  const pickerRef = useRef<HTMLInputElement>(null);
  const submitRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState<File | null>(null);
  const [result, setResult] = useState<{ file: File; url: string } | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    []
  );

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
      <div className={cn("flex h-8 items-center rounded-lg border border-input bg-transparent transition-colors dark:bg-input/30", className)}>
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
          <span className={cn("truncate", result ? "text-foreground" : "text-muted-foreground")}>{result ? t("photo.edited") : t("common.fileInput.placeholder")}</span>
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
