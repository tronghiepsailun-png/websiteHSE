"use client";

import { EmployeeCombobox } from "@/components/employees/employee-combobox";
import type { EmployeeLite } from "@/server/employees";
import { Input } from "@/components/ui/input";
import { AmountInput } from "@/components/ui/amount-input";
import { TextPresetInput } from "@/components/ui/text-preset-input";
import { TableCell } from "@/components/ui/table";
import { useT } from "@/lib/i18n/locale-context";
import { SAFETY_5S_ORG_GROUP_COLUMNS } from "./column-visibility";

export type ContentPresetOption = { value: string; label: string };

export type Safety5sRowFormValues = {
  id: string;
  employee: EmployeeLite | null;
  violationContent: string;
  violationDate: Date | string | null;
  fineAmountVnd: number | null;
  note: string | null;
} | null;

function toDateInputValue(d: Date | string | null | undefined): string {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

const cellClass = "p-1.5 align-top whitespace-normal";

/** Same "type directly into the row" pattern as "Vi phạm liên đế": every control carries
 *  `form={formId}` so it submits through the one shared <form> the table renders outside the
 *  <table>. Picking the employee is the only real input for the identity/department columns
 *  — those are auto-snapshotted from the chosen employee on save (see actions.ts). */
export function Safety5sRowCells({
  stt,
  existing,
  formId,
  hiddenColumns,
  contentOptions,
}: {
  stt: number;
  existing: Safety5sRowFormValues;
  formId: string;
  hiddenColumns: Set<string>;
  contentOptions: ContentPresetOption[];
}) {
  const t = useT();
  // The identity/org columns are read-only snapshots auto-filled from the chosen employee, so
  // they collapse into two merged cells while editing rather than one input each — hiding one of
  // the underlying columns just narrows the merge instead of leaving a stray empty cell behind.
  const identityColSpan = 1 + (hiddenColumns.has("employeeCode") ? 0 : 1) + (hiddenColumns.has("fullNameZh") ? 0 : 1);
  const orgGroupVisibleCount = SAFETY_5S_ORG_GROUP_COLUMNS.filter((c) => !hiddenColumns.has(c)).length;

  return (
    <>
      <TableCell className={cellClass}>
        <span className="flex h-8 items-center text-muted-foreground">{stt}</span>
      </TableCell>

      <TableCell className={cellClass} colSpan={identityColSpan}>
        <EmployeeCombobox
          name="employeeId"
          formId={formId}
          defaultValue={existing?.employee ?? null}
          placeholder={t("violationsLienDe.form.employeePlaceholder")}
          emptyLabel={t("violationsLienDe.form.employeeEmpty")}
          className="min-w-56"
        />
      </TableCell>

      {orgGroupVisibleCount > 0 && (
        <TableCell className={`${cellClass} text-xs text-muted-foreground`} colSpan={orgGroupVisibleCount}>
          {t("violationsLienDe.form.autoFillHint")}
        </TableCell>
      )}

      <TableCell className={cellClass}>
        <TextPresetInput
          name="violationContent"
          formId={formId}
          defaultValue={existing?.violationContent}
          placeholder={t("violations5s.form.contentPlaceholder")}
          className="min-w-48"
          required
          options={contentOptions}
        />
      </TableCell>

      <TableCell className={cellClass}>
        <Input name="violationDate" form={formId} type="date" defaultValue={toDateInputValue(existing?.violationDate)} className="min-w-[140px]" required />
      </TableCell>

      <TableCell className={cellClass}>
        <AmountInput name="fineAmountVnd" formId={formId} defaultValue={existing?.fineAmountVnd} placeholder="—" className="min-w-32" />
      </TableCell>

      {!hiddenColumns.has("note") && (
        <TableCell className={cellClass}>
          <Input name="note" form={formId} defaultValue={existing?.note ?? ""} placeholder={t("violations5s.form.notePlaceholder")} className="min-w-32" />
        </TableCell>
      )}
    </>
  );
}
