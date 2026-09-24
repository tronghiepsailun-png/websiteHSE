"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useT } from "@/lib/i18n/locale-context";
import type { DictionaryKey } from "@/lib/i18n/translate";
import {
  createCatalogItemAction,
  deleteCatalogItemAction,
  moveCatalogItemAction,
  toggleCatalogItemAction,
  updateCatalogItemAction,
  type CatalogActionResult,
} from "./actions";

type Item = { id: string; nameVi: string; nameZh: string | null; isActive: boolean };

/** One editable list (add / rename / reorder / hide / delete). Every change goes straight to the
 *  server and the page refreshes, so the CAPA dropdowns pick it up immediately. */
export function CatalogEditor({ kind, titleKey, items }: { kind: "area" | "dept"; titleKey: DictionaryKey; items: Item[] }) {
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [newVi, setNewVi] = useState("");
  const [newZh, setNewZh] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editVi, setEditVi] = useState("");
  const [editZh, setEditZh] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function run(fn: () => Promise<CatalogActionResult>, onOk?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if ("error" in result) {
        setError(result.error);
        return;
      }
      onOk?.();
      router.refresh();
    });
  }

  function startEdit(item: Item) {
    setEditingId(item.id);
    setEditVi(item.nameVi);
    setEditZh(item.nameZh ?? "");
    setError(null);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">{t(titleKey)}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form
          className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => createCatalogItemAction(kind, { nameVi: newVi, nameZh: newZh }),
              () => {
                setNewVi("");
                setNewZh("");
              }
            );
          }}
        >
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor={`catalog-${kind}-vi`}>
              {t("capa.catalog.nameVi")}
            </label>
            <Input id={`catalog-${kind}-vi`} value={newVi} onChange={(e) => setNewVi(e.target.value)} placeholder={t("capa.catalog.nameViPlaceholder")} maxLength={200} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor={`catalog-${kind}-zh`}>
              {t("capa.catalog.nameZh")}
            </label>
            <Input id={`catalog-${kind}-zh`} value={newZh} onChange={(e) => setNewZh(e.target.value)} placeholder={t("capa.catalog.nameZhPlaceholder")} maxLength={200} />
          </div>
          <Button type="submit" disabled={pending || newVi.trim() === ""}>
            <Plus className="size-4" />
            {t("capa.catalog.add")}
          </Button>
        </form>
        <p className="text-xs text-muted-foreground">{t("capa.catalog.zhHint")}</p>
        {error && <p className="text-sm text-destructive">{error}</p>}

        <Table>
          <TableHeader>
            <TableRow className="h-11">
              <TableHead>{t("capa.catalog.nameVi")}</TableHead>
              <TableHead>{t("capa.catalog.nameZh")}</TableHead>
              <TableHead className="w-32">{t("common.status")}</TableHead>
              <TableHead className="w-56" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, i) =>
              editingId === item.id ? (
                <TableRow key={item.id}>
                  <TableCell className="p-1.5">
                    <Input value={editVi} onChange={(e) => setEditVi(e.target.value)} maxLength={200} aria-label={t("capa.catalog.nameVi")} />
                  </TableCell>
                  <TableCell className="p-1.5">
                    <Input value={editZh} onChange={(e) => setEditZh(e.target.value)} maxLength={200} aria-label={t("capa.catalog.nameZh")} />
                  </TableCell>
                  <TableCell />
                  <TableCell className="p-1.5">
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-8 text-primary"
                        disabled={pending || editVi.trim() === ""}
                        aria-label={t("common.save")}
                        onClick={() => run(() => updateCatalogItemAction(item.id, { nameVi: editVi, nameZh: editZh }), () => setEditingId(null))}
                      >
                        <Check className="size-4" />
                      </Button>
                      <Button type="button" size="icon" variant="ghost" className="size-8" aria-label={t("common.cancel")} onClick={() => setEditingId(null)}>
                        <X className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                <TableRow key={item.id} className="h-12">
                  <TableCell className="py-2 font-medium">{item.nameVi}</TableCell>
                  <TableCell className="py-2 text-muted-foreground">{item.nameZh || "—"}</TableCell>
                  <TableCell className="py-2">
                    <Badge variant={item.isActive ? "default" : "secondary"}>{item.isActive ? t("common.active") : t("common.inactive")}</Badge>
                  </TableCell>
                  <TableCell className="py-2">
                    <div className="flex items-center gap-0.5">
                      <Button type="button" size="icon" variant="ghost" className="size-8" disabled={pending || i === 0} aria-label={t("capa.catalog.moveUp")} onClick={() => run(() => moveCatalogItemAction(item.id, "up"))}>
                        <ArrowUp className="size-4" />
                      </Button>
                      <Button type="button" size="icon" variant="ghost" className="size-8" disabled={pending || i === items.length - 1} aria-label={t("capa.catalog.moveDown")} onClick={() => run(() => moveCatalogItemAction(item.id, "down"))}>
                        <ArrowDown className="size-4" />
                      </Button>
                      <Button type="button" size="icon" variant="ghost" className="size-8" disabled={pending} aria-label={t("common.edit")} onClick={() => startEdit(item)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => run(() => toggleCatalogItemAction(item.id, !item.isActive))}>
                        {item.isActive ? t("common.deactivate") : t("common.activate")}
                      </Button>
                      <Button type="button" size="icon" variant="ghost" className="size-8 text-destructive" disabled={pending} aria-label={t("common.delete")} onClick={() => setDeleteId(item.id)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            )}
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                  {t("capa.catalog.empty")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        description={t("capa.catalog.deleteConfirm")}
        confirmLabel={t("common.delete")}
        pending={pending}
        onConfirm={() => deleteId && run(() => deleteCatalogItemAction(deleteId))}
      />
    </Card>
  );
}
