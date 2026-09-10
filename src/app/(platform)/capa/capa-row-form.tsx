"use client";

import { useState } from "react";
import { CAPA_CLASSIFICATIONS } from "@/lib/capa-constants";
import { Input } from "@/components/ui/input";
import { FileInput } from "@/components/ui/file-input";
import { TableCell } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useT } from "@/lib/i18n/locale-context";
import type { DictionaryKey } from "@/lib/i18n/translate";

export type WorkshopOption = { id: string; name: string };

export type CapaRowFormValues = {
  id: string;
  area: string | null;
  action: string;
  discoveredDate: Date | string | null;
  classification: string | null;
  responsibleDept: string | null;
  completionDate: Date | string | null;
  beforePhoto: { fileName: string } | null;
  afterPhoto: { fileName: string } | null;
} | null;

function toDateInputValue(d: Date | string | null | undefined): string {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

const cellClass = "p-1.5 align-top whitespace-normal";

/** A Base UI Select's own `name` prop doesn't reliably wire up to an externally-referenced
 *  <form> the way a plain native input does (same reason EmployeeCombobox pairs a hidden
 *  native input alongside it) — so each select here is controlled and mirrors its value into
 *  a sibling `<input type="hidden" form={formId}>` that actually submits with the row's form. */
function InlineSelect({
  name,
  formId,
  defaultValue,
  placeholder,
  options,
}: {
  name: string;
  formId: string;
  defaultValue: string | null | undefined;
  placeholder: string;
  options: { value: string; label: string }[];
}) {
  const [value, setValue] = useState(defaultValue ?? "");
  return (
    <>
      <input type="hidden" name={name} form={formId} value={value} />
      <Select value={value || undefined} onValueChange={(v) => setValue(v ?? "")}>
        <SelectTrigger className="w-full min-w-36">
          <SelectValue placeholder={placeholder}>{() => options.find((o) => o.value === value)?.label || placeholder}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}

/** Renders the same 9 data cells as a read-only row, but each one is its own compact input —
 *  spreadsheet-style "type directly into the row" instead of a separate expanded form block.
 *  Every control carries `form={formId}` so it submits through the one shared <form> element
 *  CapaTable renders outside the <table> (table markup can't contain a <form> ancestor, but
 *  HTML lets any control outside a form join it via the form="" attribute). Cells whose column
 *  is hidden via the "Cột hiển thị" menu are skipped entirely so the row's cell count still
 *  matches the (also-hidden-aware) header — hiding a column mid-edit doesn't lose that field's
 *  value, since a hidden input keeps submitting it either way (see below). */
export function CapaRowCells({
  stt,
  existing,
  workshops,
  formId,
  hiddenColumns,
}: {
  stt: number;
  existing: CapaRowFormValues;
  workshops: WorkshopOption[];
  formId: string;
  hiddenColumns: Set<string>;
}) {
  const t = useT();
  const workshopOptions = workshops.map((w) => ({ value: w.name, label: w.name }));
  const classificationOptions = CAPA_CLASSIFICATIONS.map((c) => ({ value: c, label: t(`capa.classification.${c}` as DictionaryKey) }));

  return (
    <>
      <TableCell className={cellClass}>
        <span className="flex h-8 items-center text-muted-foreground">{stt}</span>
      </TableCell>

      {!hiddenColumns.has("area") && (
        <TableCell className={cellClass}>
          <InlineSelect name="area" formId={formId} defaultValue={existing?.area} placeholder={t("capa.form.areaPlaceholder")} options={workshopOptions} />
        </TableCell>
      )}

      <TableCell className={cellClass}>
        <Input name="action" form={formId} defaultValue={existing?.action ?? ""} placeholder={t("capa.form.issuePlaceholder")} required className="min-w-40" />
      </TableCell>

      {!hiddenColumns.has("discoveredDate") && (
        <TableCell className={cellClass}>
          <Input
            name="discoveredDate"
            form={formId}
            type="date"
            defaultValue={toDateInputValue(existing?.discoveredDate) || new Date().toISOString().slice(0, 10)}
            className="min-w-[140px]"
          />
        </TableCell>
      )}

      {!hiddenColumns.has("classification") && (
        <TableCell className={cellClass}>
          <InlineSelect
            name="classification"
            formId={formId}
            defaultValue={existing?.classification}
            placeholder={t("capa.form.classificationPlaceholder")}
            options={classificationOptions}
          />
        </TableCell>
      )}

      {!hiddenColumns.has("responsibleDept") && (
        <TableCell className={cellClass}>
          <InlineSelect
            name="responsibleDept"
            formId={formId}
            defaultValue={existing?.responsibleDept}
            placeholder={t("capa.form.responsibleDeptPlaceholder")}
            options={workshopOptions}
          />
        </TableCell>
      )}

      {!hiddenColumns.has("photoBefore") && (
        <TableCell className={cellClass}>
          {existing?.beforePhoto && <p className="line-clamp-1 text-[11px] text-muted-foreground">{existing.beforePhoto.fileName}</p>}
          <FileInput name="beforeFile" formId={formId} accept="image/jpeg,image/png,image/webp,image/gif" className="w-32 text-xs" />
        </TableCell>
      )}

      {!hiddenColumns.has("photoAfter") && (
        <TableCell className={cellClass}>
          {existing?.afterPhoto && <p className="line-clamp-1 text-[11px] text-muted-foreground">{existing.afterPhoto.fileName}</p>}
          <FileInput name="afterFile" formId={formId} accept="image/jpeg,image/png,image/webp,image/gif" className="w-32 text-xs" />
        </TableCell>
      )}

      {!hiddenColumns.has("confirmedDate") && (
        <TableCell className={cellClass}>
          <Input name="completionDate" form={formId} type="date" defaultValue={toDateInputValue(existing?.completionDate)} className="min-w-[140px]" />
        </TableCell>
      )}

      {!hiddenColumns.has("daysUnresolved") && (
        <TableCell className={cellClass}>
          <span className="flex h-8 items-center text-muted-foreground">—</span>
        </TableCell>
      )}
    </>
  );
}
