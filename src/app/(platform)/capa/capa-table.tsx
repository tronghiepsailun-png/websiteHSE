"use client";

import { useEffect, useState, useTransition, useActionState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Plus, Check, X } from "lucide-react";
import { deleteCapaAction, saveCapaRowAction, type CapaRowState } from "./actions";
import { CapaRowCells, type CapaRowFormValues, type WorkshopOption } from "./capa-row-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ColumnVisibilityMenu } from "@/components/ui/column-visibility-menu";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import { EmptyState } from "@/components/ui/empty-state";
import { useT } from "@/lib/i18n/locale-context";
import type { DictionaryKey } from "@/lib/i18n/translate";
import { CAPA_COLUMNS_COOKIE, CAPA_TOGGLEABLE_COLUMNS } from "./column-visibility";

export type CapaRowData = {
  id: string;
  area: string | null;
  action: string;
  discoveredDate: Date | null;
  classification: string | null;
  responsibleDept: string | null;
  dueDate: Date | null;
  completionDate: Date | null;
  status: string;
  daysUnresolved: number | null;
  before: { id: string; fileName: string } | null;
  after: { id: string; fileName: string } | null;
};

const FORM_ID = "capa-row-form";

function Thumb({ doc }: { doc: { id: string; fileName: string } | null }) {
  if (!doc) return <span className="text-xs text-muted-foreground">—</span>;
  return <ImageLightbox src={`/api/documents/${doc.id}`} alt={doc.fileName} size={88} />;
}

function toFormValues(row: CapaRowData): CapaRowFormValues {
  return {
    id: row.id,
    area: row.area,
    action: row.action,
    discoveredDate: row.discoveredDate,
    classification: row.classification,
    responsibleDept: row.responsibleDept,
    completionDate: row.completionDate,
    beforePhoto: row.before,
    afterPhoto: row.after,
  };
}

export function CapaTable({
  items,
  workshops,
  canCreate,
  canEdit,
  canDelete,
  hiddenColumns,
}: {
  items: CapaRowData[];
  workshops: WorkshopOption[];
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  hiddenColumns: string[];
}) {
  const t = useT();
  const router = useRouter();
  const hidden = new Set(hiddenColumns);
  const [addingNew, setAddingNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, startDeleteTransition] = useTransition();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [saveState, formAction, pending] = useActionState<CapaRowState, FormData>(saveCapaRowAction, undefined);

  useEffect(() => {
    if (saveState && "success" in saveState) {
      setAddingNew(false);
      setEditingId(null);
      router.refresh();
    }
  }, [saveState, router]);

  function handleDelete(id: string) {
    startDeleteTransition(async () => {
      await deleteCapaAction(id);
      setConfirmDeleteId(null);
      router.refresh();
    });
  }

  const showActionsColumn = canEdit || canDelete;
  const activeId = addingNew ? "" : editingId;

  return (
    <div className="flex flex-col gap-3">
      {/* Lives outside <table> — a <form> can't legally wrap <tr>/<td>, so every input in the
          active row instead references this by id via its own form="" attribute. Only one row
          is ever editable at a time, so one shared form element is enough. */}
      <form id={FORM_ID} action={formAction}>
        <input type="hidden" name="capaId" value={activeId ?? ""} />
      </form>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <ColumnVisibilityMenu columns={CAPA_TOGGLEABLE_COLUMNS} hiddenColumns={hiddenColumns} cookieName={CAPA_COLUMNS_COOKIE} />
        {canCreate && !addingNew && !editingId && (
          <Button type="button" size="sm" onClick={() => setAddingNew(true)}>
            <Plus className="size-4" />
            {t("capa.addButton")}
          </Button>
        )}
      </div>

      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow className="h-11">
              <TableHead className="w-12">{t("capa.table.stt")}</TableHead>
              {!hidden.has("area") && <TableHead>{t("capa.table.area")}</TableHead>}
              <TableHead className="min-w-48">{t("capa.table.issue")}</TableHead>
              {!hidden.has("discoveredDate") && <TableHead>{t("capa.table.discoveredDate")}</TableHead>}
              {!hidden.has("classification") && <TableHead>{t("capa.table.classification")}</TableHead>}
              {!hidden.has("responsibleDept") && <TableHead>{t("capa.form.responsible")}</TableHead>}
              {!hidden.has("photoBefore") && <TableHead>{t("capa.table.photoBefore")}</TableHead>}
              {!hidden.has("photoAfter") && <TableHead>{t("capa.table.photoAfter")}</TableHead>}
              {!hidden.has("confirmedDate") && <TableHead>{t("capa.table.confirmedDate")}</TableHead>}
              {!hidden.has("daysUnresolved") && <TableHead>{t("capa.table.daysUnresolved")}</TableHead>}
              {showActionsColumn && <TableHead className="w-16" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {addingNew && (
              <TableRow>
                <CapaRowCells stt={items.length + 1} existing={null} workshops={workshops} formId={FORM_ID} hiddenColumns={hidden} />
                {showActionsColumn && (
                  <TableCell className="p-1.5 align-top">
                    <RowActions pending={pending} onCancel={() => setAddingNew(false)} />
                  </TableCell>
                )}
              </TableRow>
            )}

            {items.map((row, i) =>
              editingId === row.id ? (
                <TableRow key={row.id}>
                  <CapaRowCells stt={i + 1} existing={toFormValues(row)} workshops={workshops} formId={FORM_ID} hiddenColumns={hidden} />
                  {showActionsColumn && (
                    <TableCell className="p-1.5 align-top">
                      <RowActions pending={pending} onCancel={() => setEditingId(null)} />
                    </TableCell>
                  )}
                </TableRow>
              ) : (
                <TableRow key={row.id} className="h-24">
                  <TableCell className="py-3 text-muted-foreground">{i + 1}</TableCell>
                  {!hidden.has("area") && <TableCell className="py-3 font-medium">{row.area || "—"}</TableCell>}
                  <TableCell className="max-w-xs py-3 whitespace-normal break-words">{row.action}</TableCell>
                  {!hidden.has("discoveredDate") && (
                    <TableCell className="py-3">{row.discoveredDate ? new Date(row.discoveredDate).toLocaleDateString() : "—"}</TableCell>
                  )}
                  {!hidden.has("classification") && (
                    <TableCell className="py-3">{row.classification ? t(`capa.classification.${row.classification}` as DictionaryKey) : "—"}</TableCell>
                  )}
                  {!hidden.has("responsibleDept") && <TableCell className="py-3">{row.responsibleDept || "—"}</TableCell>}
                  {!hidden.has("photoBefore") && (
                    <TableCell className="py-3">
                      <Thumb doc={row.before} />
                    </TableCell>
                  )}
                  {!hidden.has("photoAfter") && (
                    <TableCell className="py-3">
                      {row.after ? <Thumb doc={row.after} /> : <span className="text-xs font-medium text-destructive">{t("capa.table.notResolved")}</span>}
                    </TableCell>
                  )}
                  {!hidden.has("confirmedDate") && (
                    <TableCell className="py-3">{row.completionDate ? new Date(row.completionDate).toLocaleDateString() : "—"}</TableCell>
                  )}
                  {!hidden.has("daysUnresolved") && <TableCell className="py-3">{row.daysUnresolved ?? "—"}</TableCell>}
                  {showActionsColumn && (
                    <TableCell className="py-3">
                      <div className="flex items-center gap-1">
                        {canEdit && (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="size-7"
                            disabled={addingNew}
                            onClick={() => setEditingId(row.id)}
                          >
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
                <TableCell colSpan={2 + CAPA_TOGGLEABLE_COLUMNS.length - hidden.size + (showActionsColumn ? 1 : 0)}>
                  <EmptyState message={t("capa.table.noResults")} />
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
        description={t("capa.detail.deleteConfirm")}
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
