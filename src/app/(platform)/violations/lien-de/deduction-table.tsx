"use client";

import { useEffect, useState, useTransition, useActionState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Plus, Check, X } from "lucide-react";
import { deleteWorkInjuryDeductionAction, saveWorkInjuryDeductionAction, type DeductionRowState } from "./actions";
import { DeductionRowCells, type DeductionRowFormValues } from "./deduction-row-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ColumnVisibilityMenu } from "@/components/ui/column-visibility-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { useT } from "@/lib/i18n/locale-context";
import { DEDUCTION_COLUMNS_COOKIE, DEDUCTION_TOGGLEABLE_COLUMNS } from "./column-visibility";

export type DeductionRowData = {
  id: string;
  employeeId: string | null;
  employeeCodeSnapshot: string | null;
  fullNameZhSnapshot: string | null;
  fullNameViSnapshot: string | null;
  orgUnitLevel1Snapshot: string | null;
  regionSnapshot: string | null;
  orgUnitLevel2Snapshot: string | null;
  teamSnapshot: string | null;
  shiftSnapshot: string | null;
  positionSnapshot: string | null;
  accidentDate: Date | null;
  reporterName: string | null;
  fineAmountVnd: number;
};

const FORM_ID = "deduction-row-form";

function vnd(n: number) {
  return `${n.toLocaleString("vi-VN")} đ`;
}

function toFormValues(row: DeductionRowData): DeductionRowFormValues {
  return {
    id: row.id,
    employee: row.employeeId
      ? { id: row.employeeId, employeeCode: row.employeeCodeSnapshot ?? "", fullName: row.fullNameViSnapshot ?? "", fullNameZh: row.fullNameZhSnapshot }
      : null,
    accidentDate: row.accidentDate,
    reporterName: row.reporterName,
    fineAmountVnd: row.fineAmountVnd,
  };
}

export function DeductionTable({
  items,
  year,
  month,
  canEdit,
  canDelete,
  hiddenColumns,
}: {
  items: DeductionRowData[];
  year: number;
  month: number;
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
  const [saveState, formAction, pending] = useActionState<DeductionRowState, FormData>(saveWorkInjuryDeductionAction, undefined);

  useEffect(() => {
    if (saveState && "success" in saveState) {
      setAddingNew(false);
      setEditingId(null);
      // A row's period is the month its accident date falls in — if that lands outside the
      // month currently being viewed (e.g. the very first entry for a new month), follow it
      // there instead of leaving the row to silently vanish from the current view.
      if (saveState.year !== year || saveState.month !== month) {
        router.push(`/violations/lien-de?ym=${saveState.year}-${saveState.month}`);
      } else {
        router.refresh();
      }
    }
  }, [saveState, router, year, month]);

  function handleDelete(id: string) {
    startDeleteTransition(async () => {
      await deleteWorkInjuryDeductionAction(id);
      setConfirmDeleteId(null);
      router.refresh();
    });
  }

  const activeId = addingNew ? "" : editingId;

  return (
    <div className="flex flex-col gap-3">
      <form id={FORM_ID} action={formAction}>
        <input type="hidden" name="deductionId" value={activeId ?? ""} />
      </form>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <ColumnVisibilityMenu columns={DEDUCTION_TOGGLEABLE_COLUMNS} hiddenColumns={hiddenColumns} cookieName={DEDUCTION_COLUMNS_COOKIE} />
        {canEdit && !addingNew && !editingId && (
          <Button type="button" size="sm" onClick={() => setAddingNew(true)}>
            <Plus className="size-4" />
            {t("violationsLienDe.addButton")}
          </Button>
        )}
      </div>

      <Card className="overflow-x-auto py-0">
        <Table>
          <TableHeader>
            <TableRow className="h-11">
              <TableHead className="w-12">{t("capa.table.stt")}</TableHead>
              {!hidden.has("employeeCode") && <TableHead>{t("violationsLienDe.table.employeeCode")}</TableHead>}
              {!hidden.has("fullNameZh") && <TableHead>{t("violationsLienDe.table.fullNameZh")}</TableHead>}
              <TableHead>{t("violationsLienDe.table.fullNameVi")}</TableHead>
              {!hidden.has("orgUnitLevel1") && <TableHead>{t("violationsLienDe.table.orgUnitLevel1")}</TableHead>}
              {!hidden.has("region") && <TableHead>{t("violationsLienDe.table.region")}</TableHead>}
              {!hidden.has("orgUnitLevel2") && <TableHead>{t("violationsLienDe.table.orgUnitLevel2")}</TableHead>}
              {!hidden.has("team") && <TableHead>{t("violationsLienDe.table.team")}</TableHead>}
              {!hidden.has("shift") && <TableHead>{t("violationsLienDe.table.shift")}</TableHead>}
              {!hidden.has("position") && <TableHead>{t("violationsLienDe.table.position")}</TableHead>}
              <TableHead>{t("violationsLienDe.table.accidentDate")}</TableHead>
              {!hidden.has("reporterName") && <TableHead>{t("violationsLienDe.table.reporterName")}</TableHead>}
              <TableHead className="text-right">{t("violationsLienDe.table.fineAmount")}</TableHead>
              {canManage && <TableHead className="w-16" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {addingNew && (
              <TableRow>
                <DeductionRowCells stt={items.length + 1} existing={null} formId={FORM_ID} hiddenColumns={hidden} />
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
                  <DeductionRowCells stt={i + 1} existing={toFormValues(row)} formId={FORM_ID} hiddenColumns={hidden} />
                  {canManage && (
                    <TableCell className="p-1.5 align-top">
                      {canEdit && <RowActions pending={pending} onCancel={() => setEditingId(null)} />}
                    </TableCell>
                  )}
                </TableRow>
              ) : (
                <TableRow key={row.id} className="h-14">
                  <TableCell className="py-3 text-muted-foreground">{i + 1}</TableCell>
                  {!hidden.has("employeeCode") && <TableCell className="py-3">{row.employeeCodeSnapshot || "—"}</TableCell>}
                  {!hidden.has("fullNameZh") && <TableCell className="py-3">{row.fullNameZhSnapshot || "—"}</TableCell>}
                  <TableCell className="py-3 font-medium">{row.fullNameViSnapshot || "—"}</TableCell>
                  {!hidden.has("orgUnitLevel1") && <TableCell className="py-3 text-muted-foreground">{row.orgUnitLevel1Snapshot || "—"}</TableCell>}
                  {!hidden.has("region") && <TableCell className="py-3 text-muted-foreground">{row.regionSnapshot || "—"}</TableCell>}
                  {!hidden.has("orgUnitLevel2") && <TableCell className="py-3 text-muted-foreground">{row.orgUnitLevel2Snapshot || "—"}</TableCell>}
                  {!hidden.has("team") && <TableCell className="py-3 text-muted-foreground">{row.teamSnapshot || "—"}</TableCell>}
                  {!hidden.has("shift") && <TableCell className="py-3 text-muted-foreground">{row.shiftSnapshot || "—"}</TableCell>}
                  {!hidden.has("position") && <TableCell className="py-3 text-muted-foreground">{row.positionSnapshot || "—"}</TableCell>}
                  <TableCell className="py-3 whitespace-nowrap">{row.accidentDate ? new Date(row.accidentDate).toLocaleDateString("vi-VN") : "—"}</TableCell>
                  {!hidden.has("reporterName") && <TableCell className="py-3">{row.reporterName || "—"}</TableCell>}
                  <TableCell className="py-3 text-right whitespace-nowrap">{vnd(row.fineAmountVnd)}</TableCell>
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
                <TableCell colSpan={4 + DEDUCTION_TOGGLEABLE_COLUMNS.length - hidden.size + (canManage ? 1 : 0)}>
                  <EmptyState message={t("violationsLienDe.table.noResults")} />
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
        description={t("violationsLienDe.table.deleteConfirm")}
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
