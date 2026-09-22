"use client";

import { useEffect, useState, useTransition, useActionState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Plus, Check, X } from "lucide-react";
import { deleteSafety5sViolationAction, saveSafety5sViolationAction, type Safety5sRowState } from "./actions";
import { Safety5sRowCells, type Safety5sRowFormValues, type ContentPresetOption } from "./safety-5s-row-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ColumnVisibilityMenu } from "@/components/ui/column-visibility-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { useT } from "@/lib/i18n/locale-context";
import { SAFETY_5S_COLUMNS_COOKIE, SAFETY_5S_TOGGLEABLE_COLUMNS } from "./column-visibility";

export type Safety5sRowData = {
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
  violationContent: string;
  violationDate: Date | null;
  fineAmountVnd: number | null;
  note: string | null;
};

const FORM_ID = "safety-5s-row-form";

function vnd(n: number | null) {
  if (n === null) return "—";
  return `${n.toLocaleString("vi-VN")} đ`;
}

function toFormValues(row: Safety5sRowData): Safety5sRowFormValues {
  return {
    id: row.id,
    employee: row.employeeId
      ? { id: row.employeeId, employeeCode: row.employeeCodeSnapshot ?? "", fullName: row.fullNameViSnapshot ?? "", fullNameZh: row.fullNameZhSnapshot }
      : null,
    violationContent: row.violationContent,
    violationDate: row.violationDate,
    fineAmountVnd: row.fineAmountVnd,
    note: row.note,
  };
}

export function Safety5sTable({
  items,
  year,
  month,
  canEdit,
  canDelete,
  hiddenColumns,
  contentOptions,
}: {
  items: Safety5sRowData[];
  year: number;
  month: number;
  canEdit: boolean;
  canDelete: boolean;
  hiddenColumns: string[];
  contentOptions: ContentPresetOption[];
}) {
  const canManage = canEdit || canDelete;
  const t = useT();
  const router = useRouter();
  const hidden = new Set(hiddenColumns);
  const [addingNew, setAddingNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, startDeleteTransition] = useTransition();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [saveState, formAction, pending] = useActionState<Safety5sRowState, FormData>(saveSafety5sViolationAction, undefined);

  useEffect(() => {
    if (saveState && "success" in saveState) {
      setAddingNew(false);
      setEditingId(null);
      // A row's period is the month its violation date falls in — if that lands outside the
      // month currently being viewed (e.g. the very first entry for a new month), follow it
      // there instead of leaving the row to silently vanish from the current view.
      if (saveState.year !== year || saveState.month !== month) {
        router.push(`/violations/5s?ym=${saveState.year}-${saveState.month}`);
      } else {
        router.refresh();
      }
    }
  }, [saveState, router, year, month]);

  function handleDelete(id: string) {
    startDeleteTransition(async () => {
      await deleteSafety5sViolationAction(id);
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
        <ColumnVisibilityMenu columns={SAFETY_5S_TOGGLEABLE_COLUMNS} hiddenColumns={hiddenColumns} cookieName={SAFETY_5S_COLUMNS_COOKIE} />
        {canEdit && !addingNew && !editingId && (
          <Button type="button" size="sm" onClick={() => setAddingNew(true)}>
            <Plus className="size-4" />
            {t("violations5s.addButton")}
          </Button>
        )}
      </div>

      <Card className="py-0">
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
              <TableHead>{t("violations5s.table.content")}</TableHead>
              <TableHead>{t("violations5s.table.date")}</TableHead>
              <TableHead className="text-right">{t("violationsLienDe.table.fineAmount")}</TableHead>
              {!hidden.has("note") && <TableHead>{t("violations5s.table.note")}</TableHead>}
              {canManage && <TableHead className="w-16" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {addingNew && (
              <TableRow>
                <Safety5sRowCells stt={items.length + 1} existing={null} formId={FORM_ID} hiddenColumns={hidden} contentOptions={contentOptions} />
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
                  <Safety5sRowCells stt={i + 1} existing={toFormValues(row)} formId={FORM_ID} hiddenColumns={hidden} contentOptions={contentOptions} />
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
                  <TableCell className="py-3">{row.violationContent}</TableCell>
                  <TableCell className="py-3 whitespace-nowrap">{row.violationDate ? new Date(row.violationDate).toLocaleDateString("vi-VN") : "—"}</TableCell>
                  <TableCell className="py-3 text-right whitespace-nowrap">{vnd(row.fineAmountVnd)}</TableCell>
                  {!hidden.has("note") && <TableCell className="py-3 text-muted-foreground">{row.note || "—"}</TableCell>}
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
                <TableCell colSpan={5 + SAFETY_5S_TOGGLEABLE_COLUMNS.length - hidden.size + (canManage ? 1 : 0)}>
                  <EmptyState message={t("violations5s.table.noResults")} />
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
        description={t("violations5s.table.deleteConfirm")}
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
