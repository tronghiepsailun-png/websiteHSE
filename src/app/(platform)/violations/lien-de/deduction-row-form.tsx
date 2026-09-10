"use client";

import { EmployeeCombobox } from "@/components/employees/employee-combobox";
import type { EmployeeLite } from "@/server/employees";
import { Input } from "@/components/ui/input";
import { AmountInput } from "@/components/ui/amount-input";
import { TableCell } from "@/components/ui/table";
import { useT } from "@/lib/i18n/locale-context";
import { DEDUCTION_ORG_GROUP_COLUMNS } from "./column-visibility";

export type DeductionRowFormValues = {
  id: string;
  employee: EmployeeLite | null;
  accidentDate: Date | string | null;
  reporterName: string | null;
  fineAmountVnd: number;
} | null;

function toDateInputValue(d: Date | string | null | undefined): string {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

const cellClass = "p-1.5 align-top whitespace-normal";

/** Same "type directly into the row" pattern as CAPA's compact table: every control carries
 *  `form={formId}` so it submits through the one shared <form> element the table renders
 *  outside the <table> (a literal <form> can't wrap <tr>/<td>). Picking the employee is the
 *  only real input for the identity/department columns — those are auto-snapshotted from the
 *  chosen employee on save (see actions.ts), not retyped by hand. */
export function DeductionRowCells({
  stt,
  existing,
  formId,
  hiddenColumns,
}: {
  stt: number;
  existing: DeductionRowFormValues;
  formId: string;
  hiddenColumns: Set<string>;
}) {
  const t = useT();
  const identityColSpan = 1 + (hiddenColumns.has("employeeCode") ? 0 : 1) + (hiddenColumns.has("fullNameZh") ? 0 : 1);
  const orgGroupVisibleCount = DEDUCTION_ORG_GROUP_COLUMNS.filter((c) => !hiddenColumns.has(c)).length;

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
        <Input name="accidentDate" form={formId} type="date" defaultValue={toDateInputValue(existing?.accidentDate)} className="min-w-[140px]" required />
      </TableCell>

      {!hiddenColumns.has("reporterName") && (
        <TableCell className={cellClass}>
          <Input name="reporterName" form={formId} defaultValue={existing?.reporterName ?? ""} placeholder={t("violationsLienDe.form.reporterPlaceholder")} className="min-w-32" />
        </TableCell>
      )}

      <TableCell className={cellClass}>
        <AmountInput name="fineAmountVnd" formId={formId} defaultValue={existing?.fineAmountVnd ?? 0} className="min-w-32" required />
      </TableCell>
    </>
  );
}
