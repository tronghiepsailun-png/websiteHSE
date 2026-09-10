"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { AmountInput } from "@/components/ui/amount-input";
import { TableCell } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useT } from "@/lib/i18n/locale-context";

export type OfficerOption = {
  id: string;
  employeeCode: string;
  fullName: string;
  fullNameZh: string | null;
  dept1: string | null;
  dept2: string | null;
  region: string | null;
  shift: string | null;
};

export type ViolationTypeOption = { id: string; labelVi: string; labelZh: string | null };

export type ViolationRowFormValues = {
  id: string;
  safetyOfficerId: string;
  violationTypeId: string;
  occurredAt: Date | string;
  amountVnd: number;
  note: string | null;
} | null;

function toDateInputValue(d: Date | string | null | undefined): string {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

function todayLocal() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
}

const cellClass = "p-1.5 align-top whitespace-normal";

/** Same controlled-Select-plus-hidden-input pairing as CAPA/"Vi phạm liên đế" — a Base UI
 *  Select's own `name` doesn't reliably submit through an externally-referenced <form>. */
function InlineOfficerSelect({
  formId,
  defaultValue,
  officers,
  placeholder,
  onChange,
}: {
  formId: string;
  defaultValue: string | null | undefined;
  officers: OfficerOption[];
  placeholder: string;
  onChange: (id: string) => void;
}) {
  const [value, setValue] = useState(defaultValue ?? "");
  return (
    <>
      <input type="hidden" name="safetyOfficerId" form={formId} value={value} />
      <Select
        value={value || undefined}
        onValueChange={(v) => {
          const next = (v as string) ?? "";
          setValue(next);
          onChange(next);
        }}
      >
        <SelectTrigger className="w-full min-w-48">
          <SelectValue placeholder={placeholder}>
            {() => {
              const o = officers.find((x) => x.id === value);
              return o ? `${o.employeeCode} — ${o.fullName}` : placeholder;
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {officers.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.employeeCode} — {o.fullName}
              {o.fullNameZh ? ` (${o.fullNameZh})` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}

function InlineViolationTypeSelect({
  formId,
  defaultValue,
  violationTypes,
  placeholder,
}: {
  formId: string;
  defaultValue: string | null | undefined;
  violationTypes: ViolationTypeOption[];
  placeholder: string;
}) {
  const [value, setValue] = useState(defaultValue ?? "");
  return (
    <>
      <input type="hidden" name="violationTypeId" form={formId} value={value} />
      <Select value={value || undefined} onValueChange={(v) => setValue((v as string) ?? "")}>
        <SelectTrigger className="w-full min-w-40">
          <SelectValue placeholder={placeholder}>{() => violationTypes.find((v) => v.id === value)?.labelVi ?? placeholder}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {violationTypes.map((v) => (
            <SelectItem key={v.id} value={v.id}>
              {v.labelVi}
              {v.labelZh ? ` / ${v.labelZh}` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}

/** Renders the same 9 data cells as a read-only row, but each one is its own compact input —
 *  picking the officer (spans the MSNV+Nhân viên columns) auto-fills the department/khu vực/ca
 *  preview from that officer's live employee record, matching what the table itself shows. */
export function ViolationRowCells({
  stt,
  existing,
  officers,
  violationTypes,
  formId,
  hiddenColumns,
}: {
  stt: number;
  existing: ViolationRowFormValues;
  officers: OfficerOption[];
  violationTypes: ViolationTypeOption[];
  formId: string;
  hiddenColumns: Set<string>;
}) {
  const t = useT();
  const [officerId, setOfficerId] = useState(existing?.safetyOfficerId ?? "");
  const officer = officers.find((o) => o.id === officerId);

  return (
    <>
      <TableCell className={cellClass}>
        <span className="flex h-8 items-center text-muted-foreground">{stt}</span>
      </TableCell>

      <TableCell className={cellClass}>
        <Input name="occurredAt" form={formId} type="date" defaultValue={toDateInputValue(existing?.occurredAt) || todayLocal()} className="min-w-[140px]" required />
      </TableCell>

      <TableCell className={cellClass} colSpan={2}>
        <InlineOfficerSelect
          formId={formId}
          defaultValue={existing?.safetyOfficerId}
          officers={officers}
          placeholder={t("violations.form.selectOfficerPlaceholder")}
          onChange={setOfficerId}
        />
      </TableCell>

      {!hiddenColumns.has("department") && (
        <TableCell className={`${cellClass} text-muted-foreground`}>{[officer?.dept1, officer?.dept2].filter(Boolean).join(" / ") || "—"}</TableCell>
      )}
      {!hiddenColumns.has("area") && <TableCell className={`${cellClass} text-muted-foreground`}>{officer?.region || "—"}</TableCell>}
      {!hiddenColumns.has("shift") && <TableCell className={`${cellClass} text-muted-foreground`}>{officer?.shift || "—"}</TableCell>}

      <TableCell className={cellClass}>
        <InlineViolationTypeSelect formId={formId} defaultValue={existing?.violationTypeId} violationTypes={violationTypes} placeholder={t("violations.form.selectTypePlaceholder")} />
      </TableCell>

      {!hiddenColumns.has("note") && (
        <TableCell className={cellClass}>
          <Input name="note" form={formId} defaultValue={existing?.note ?? ""} className="min-w-32" />
        </TableCell>
      )}

      <TableCell className={cellClass}>
        <AmountInput name="amountVnd" formId={formId} defaultValue={existing?.amountVnd ?? 10000} className="min-w-32" required />
      </TableCell>
    </>
  );
}
