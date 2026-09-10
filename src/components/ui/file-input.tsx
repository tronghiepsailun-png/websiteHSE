"use client";

import { useId, useState } from "react";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/locale-context";

/** A file <input> styled as one clickable box with its own placeholder/filename text — the
 *  native "Choose file / No file chosen" strings a plain <input type="file"> shows are rendered
 *  by the BROWSER itself in the browser's own OS-locale, completely independent of this app's
 *  language switcher (VI/中文). That's exactly why a page set to Chinese could still show a
 *  Vietnamese file picker: the browser's locale, not the page's, controlled it. Hiding the
 *  native input (visually, not from the accessibility tree) and rendering the label ourselves
 *  lets it follow the app's actual selected locale like everything else on the page. */
export function FileInput({
  id,
  name,
  formId,
  accept,
  multiple,
  required,
  className,
  onFileNameChange,
}: {
  id?: string;
  name: string;
  formId?: string;
  accept?: string;
  multiple?: boolean;
  required?: boolean;
  className?: string;
  onFileNameChange?: (label: string) => void;
}) {
  const t = useT();
  const autoId = useId();
  const inputId = id ?? autoId;
  const [label, setLabel] = useState<string | null>(null);

  return (
    <div
      className={cn(
        "flex h-8 items-center rounded-lg border border-input bg-transparent transition-colors has-[:focus-visible]:border-ring has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50 dark:bg-input/30",
        className
      )}
    >
      <input
        id={inputId}
        name={name}
        form={formId}
        type="file"
        accept={accept}
        multiple={multiple}
        required={required}
        className="sr-only"
        onChange={(e) => {
          const files = e.target.files;
          const next =
            !files || files.length === 0
              ? null
              : files.length === 1
                ? files[0].name
                : t("common.fileInput.multipleSelected", { count: files.length });
          setLabel(next);
          onFileNameChange?.(next ?? "");
        }}
      />
      <label
        htmlFor={inputId}
        className="flex h-full min-w-0 flex-1 cursor-pointer items-center gap-1.5 truncate rounded-lg px-2.5 text-sm hover:bg-muted/50"
      >
        <Upload className="size-3.5 shrink-0 text-muted-foreground" />
        <span className={cn("truncate", label ? "text-foreground" : "text-muted-foreground")}>
          {label ?? t("common.fileInput.placeholder")}
        </span>
      </label>
    </div>
  );
}
