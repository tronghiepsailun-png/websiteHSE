"use client";

import { useEffect, useState, useTransition, useActionState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Plus, Check, X } from "lucide-react";
import { deleteViolationAction, saveViolationRowAction, type ViolationRowState } from "./actions";
import { ViolationRowCells, type ViolationRowFormValues, type OfficerOption, type ViolationTypeOption } from "./violation-row-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ColumnVisibilityMenu } from "@/components/ui/column-visibility-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { useT } from "@/lib/i18n/locale-context";
import { VIOLATION_COLUMNS_COOKIE, VIOLATION_TOGGLEABLE_COLUMNS } from "./column-visibility";

export type ViolationRowData = {
  id: string;
  safetyOfficerId: string;
  employeeCode: string;
  fullName: string;
  fullNameZh: string | null;
  dept1: string | null;
  dept2: string | null;
  region: string | null;
  shift: string | null;
  violationTypeId: string;
  violationLabel: string;
  occurredAt: Date;
  note: string | null;
  amountVnd: number;
};

const FORM_ID = "violation-row-form";

function vnd(n: number) {
  return `${n.toLocaleString("vi-VN")} đ`;
}

function toFormValues(row: ViolationRowData): ViolationRowFormValues {
  return {
    id: row.id,
    safetyOfficerId: row.safetyOfficerId,
    violationTypeId: row.violationTypeId,
    occurredAt: row.occurredAt,
    amountVnd: row.amountVnd,
    note: row.note,
  };
}

export function ViolationTable({
  items,
  officers,
  violationTypes,
  year,
  month,
  canCreate,
  canEdit,
  canDelete,
  hiddenColumns,
}: {
  items: ViolationRowData[];
  officers: OfficerOption[];
  violationTypes: ViolationTypeOption[];
  year: number;
  month: number;
  /** Adding a new row needs a non-empty officer/violation-type catalog, separate from the
   *  VIOLATION_EDIT permission that governs editing rows that already exist. */
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  hiddenColumns: string[];
}) {
  const canManage = canEdit || canDelete;
  const t = useT();
  const router = useRouter();
  const hidden = new Set(hiddenColumns);
  const [addingNew, setAddingNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, startDeleteTransition] = useTransition();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [saveState, formAction, pending] = useActionState<ViolationRowState, FormData>(saveViolationRowAction, undefined);

  useEffect(() => {
    if (saveState && "success" in saveState) {
      setAddingNew(false);
      setEditingId(null);
      // A row's period is whichever month its own date falls in — if that lands outside the
      // month currently being viewed, follow it there instead of leaving it to vanish silently.
      if (saveState.year !== year || saveState.month !== month) {
        router.push(`/violations/internal?ym=${saveState.year}-${saveState.month}`);
      } else {
        router.refresh();
      }
    }
  }, [saveState, router, year, month]);

  function handleDelete(id: string) {
    startDeleteTransition(async () => {
      await deleteViolationAction(id);
      setConfirmDeleteId(null);
      router.refresh();
    });
  }

  const activeId = addingNew ? "" : editingId;

  return (
    <div className="flex flex-col gap-3">
      <form id={FORM_ID} action={formAction}>
        <input type="hidden" name="violationId" value={activeId ?? ""} />
      </form>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <ColumnVisibilityMenu columns={VIOLATION_TOGGLEABLE_COLUMNS} hiddenColumns={hiddenColumns} cookieName={VIOLATION_COLUMNS_COOKIE} />
        {canCreate && !addingNew && !editingId && (
          <Button type="button" size="sm" onClick={() => setAddingNew(true)}>
            <Plus className="size-4" />
            {t("violations.form.submit")}
          </Button>
        )}
      </div>

      <Card className="overflow-x-auto py-0">
        <Table>
          <TableHeader>
            <TableRow className="h-11">
              <TableHead className="w-12">{t("violations.table.stt")}</TableHead>
              <TableHead>{t("violations.table.date")}</TableHead>
              <TableHead>{t("violations.table.code")}</TableHead>
              <TableHead>{t("incidents.table.employee")}</TableHead>
              {!hidden.has("department") && <TableHead>{t("violations.table.department")}</TableHead>}
              {!hidden.has("area") && <TableHead>{t("violations.table.area")}</TableHead>}
              {!hidden.has("shift") && <TableHead>{t("violations.table.shift")}</TableHead>}
              <TableHead>{t("violations.form.violationType")}</TableHead>
              {!hidden.has("note") && <TableHead>{t("violations.form.note")}</TableHead>}
              <TableHead className="text-right">{t("violations.table.amount")}</TableHead>
              {canManage && <TableHead className="w-16" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {addingNew && (
              <TableRow>
                <ViolationRowCells stt={items.length + 1} existing={null} officers={officers} violationTypes={violationTypes} formId={FORM_ID} hiddenColumns={hidden} />
                {canManage && (
                  <TableCell className="p-1.5 align-top">
                    {canEdit && <RowActions pending={pending} onCancel={() => setAddingNew(false)} />}
                  </TableCell>
                )}
              </TableRow>
            )}

            {items.map((row, i) =>
              editingId === row.id ? (
                <TableRow key={row.id}>
                  <ViolationRowCells stt={i + 1} existing={toFormValues(row)} officers={officers} violationTypes={violationTypes} formId={FORM_ID} hiddenColumns={hidden} />
                  {canManage && (
                    <TableCell className="p-1.5 align-top">
                      {canEdit && <RowActions pending={pending} onCancel={() => setEditingId(null)} />}
                    </TableCell>
                  )}
                </TableRow>
              ) : (
                <TableRow key={row.id} className="h-14">
                  <TableCell className="py-3 text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="py-3 whitespace-nowrap">{new Date(row.occurredAt).toLocaleDateString("vi-VN")}</TableCell>
                  <TableCell className="py-3">{row.employeeCode}</TableCell>
                  <TableCell className="py-3">
                    <div className="font-medium">{row.fullName}</div>
                    {row.fullNameZh && <div className="text-xs text-muted-foreground">{row.fullNameZh}</div>}
                  </TableCell>
                  {!hidden.has("department") && (
                    <TableCell className="py-3 text-muted-foreground">{[row.dept1, row.dept2].filter(Boolean).join(" / ") || "—"}</TableCell>
                  )}
                  {!hidden.has("area") && <TableCell className="py-3 text-muted-foreground">{row.region || "—"}</TableCell>}
                  {!hidden.has("shift") && <TableCell className="py-3 text-muted-foreground">{row.shift || "—"}</TableCell>}
                  <TableCell className="py-3">{row.violationLabel}</TableCell>
                  {!hidden.has("note") && <TableCell className="py-3 text-muted-foreground">{row.note || "—"}</TableCell>}
                  <TableCell className="py-3 text-right whitespace-nowrap">{vnd(row.amountVnd)}</TableCell>
                  {canManage && (
                    <TableCell className="py-3">
                      <div className="flex items-center gap-1">
                        {canEdit && (
                          <Button type="button" size="icon" variant="ghost" className="size-7" disabled={addingNew} onClick={() => setEditingId(row.id)}>
                            <Pencil className="size-3.5" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button type="button" size="icon" variant="ghost" className="size-7 text-destructive" onClick={() => setConfirmDeleteId(row.id)}>
                            <Trash2 className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              )
            )}

            {items.length === 0 && !addingNew && (
              <TableRow>
                <TableCell colSpan={6 + VIOLATION_TOGGLEABLE_COLUMNS.length - hidden.size + (canManage ? 1 : 0)}>
                  <EmptyState message={t("violations.log.empty")} />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {saveState && "error" in saveState && <p className="text-sm text-destructive">{saveState.error}</p>}

      <ConfirmDialog
        open={confirmDeleteId !== null}
        onOpenChange={(open) => !open && setConfirmDeleteId(null)}
        description={t("violations.log.confirmDelete")}
        confirmLabel={t("common.delete")}
        onConfirm={() => confirmDeleteId && handleDelete(confirmDeleteId)}
        pending={deletingId}
      />
    </div>
  );
}

function RowActions({ pending, onCancel }: { pending: boolean; onCancel: () => void }) {
  return (
    <div className="flex items-center gap-1">
      <Button type="submit" form={FORM_ID} size="icon" variant="ghost" className="size-7 text-primary" disabled={pending}>
        <Check className="size-3.5" />
      </Button>
      <Button type="button" size="icon" variant="ghost" className="size-7" onClick={onCancel} disabled={pending}>
        <X className="size-3.5" />
      </Button>
    </div>
  );
}
