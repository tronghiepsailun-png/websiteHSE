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
import { cn } from "@/lib/utils";
import type { DictionaryKey } from "@/lib/i18n/translate";
import {
  createCatalogItemAction,
  deleteCatalogItemAction,
  moveCatalogItemAction,
  toggleCatalogItemAction,
  updateCatalogItemAction,
  type CatalogActionResult,
} from "./catalog-actions";

type Item = { id: string; nameVi: string; nameZh: string | null; code?: string | null; color?: string | null; isActive: boolean };

const DEFAULT_COLOR = "#92D050";

/** One editable list (add / rename / reorder / hide / delete). Every change goes straight to the
 *  server and the page refreshes, so the CAPA dropdowns pick it up immediately. `withCode` /
 *  `withColor` add an MSNV and a color column for lists that need them (the sleep module's
 *  guards); the name labels/hint can be renamed per list. */
export function CatalogEditor({
  module,
  kind,
  titleKey,
  items,
  deleteConfirmKey = "capa.catalog.deleteConfirm",
  hintKey = "capa.catalog.zhHint",
  nameViKey = "capa.catalog.nameVi",
  nameZhKey = "capa.catalog.nameZh",
  withCode = false,
  withColor = false,
}: {
  module: string;
  kind: string;
  titleKey: DictionaryKey;
  items: Item[];
  deleteConfirmKey?: DictionaryKey;
  hintKey?: DictionaryKey;
  nameViKey?: DictionaryKey;
  nameZhKey?: DictionaryKey;
  withCode?: boolean;
  withColor?: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [newVi, setNewVi] = useState("");
  const [newZh, setNewZh] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newColor, setNewColor] = useState(DEFAULT_COLOR);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editVi, setEditVi] = useState("");
  const [editZh, setEditZh] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editColor, setEditColor] = useState(DEFAULT_COLOR);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const extra = (code: string, color: string) => ({
    ...(withCode ? { code } : {}),
    ...(withColor ? { color } : {}),
  });
  const extraCols = (withCode ? 1 : 0) + (withColor ? 1 : 0);

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
    setEditCode(item.code ?? "");
    setEditColor(item.color ?? DEFAULT_COLOR);
    setError(null);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">{t(titleKey)}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form
          className={cn(
            "grid grid-cols-1 gap-3 sm:items-end",
            withCode && withColor ? "sm:grid-cols-[8rem_1fr_1fr_5rem_auto]" : withCode ? "sm:grid-cols-[8rem_1fr_1fr_auto]" : withColor ? "sm:grid-cols-[1fr_1fr_5rem_auto]" : "sm:grid-cols-[1fr_1fr_auto]"
          )}
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => createCatalogItemAction(module, kind, { nameVi: newVi, nameZh: newZh, ...extra(newCode, newColor) }),
              () => {
                setNewVi("");
                setNewZh("");
                setNewCode("");
              }
            );
          }}
        >
          {withCode && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" htmlFor={`catalog-${kind}-code`}>
                {t("catalog.field.code")}
              </label>
              <Input id={`catalog-${kind}-code`} value={newCode} onChange={(e) => setNewCode(e.target.value)} maxLength={50} />
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor={`catalog-${kind}-vi`}>
              {t(nameViKey)}
            </label>
            <Input id={`catalog-${kind}-vi`} value={newVi} onChange={(e) => setNewVi(e.target.value)} placeholder={t("capa.catalog.nameViPlaceholder")} maxLength={200} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor={`catalog-${kind}-zh`}>
              {t(nameZhKey)}
            </label>
            <Input id={`catalog-${kind}-zh`} value={newZh} onChange={(e) => setNewZh(e.target.value)} placeholder={t("capa.catalog.nameZhPlaceholder")} maxLength={200} />
          </div>
          {withColor && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" htmlFor={`catalog-${kind}-color`}>
                {t("catalog.field.color")}
              </label>
              <Input id={`catalog-${kind}-color`} type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} className="p-1" />
            </div>
          )}
          <Button type="submit" disabled={pending || newVi.trim() === ""}>
            <Plus className="size-4" />
            {t("capa.catalog.add")}
          </Button>
        </form>
        <p className="text-xs text-muted-foreground">{t(hintKey)}</p>
        {error && <p className="text-sm text-destructive">{error}</p>}

        <Table>
          <TableHeader>
            <TableRow className="h-11">
              {withCode && <TableHead className="w-28">{t("catalog.field.code")}</TableHead>}
              <TableHead>{t(nameViKey)}</TableHead>
              <TableHead>{t(nameZhKey)}</TableHead>
              {withColor && <TableHead className="w-24">{t("catalog.field.color")}</TableHead>}
              <TableHead className="w-32">{t("common.status")}</TableHead>
              <TableHead className="w-56" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, i) =>
              editingId === item.id ? (
                <TableRow key={item.id}>
                  {withCode && (
                    <TableCell className="p-1.5">
                      <Input value={editCode} onChange={(e) => setEditCode(e.target.value)} maxLength={50} aria-label={t("catalog.field.code")} />
                    </TableCell>
                  )}
                  <TableCell className="p-1.5">
                    <Input value={editVi} onChange={(e) => setEditVi(e.target.value)} maxLength={200} aria-label={t(nameViKey)} />
                  </TableCell>
                  <TableCell className="p-1.5">
                    <Input value={editZh} onChange={(e) => setEditZh(e.target.value)} maxLength={200} aria-label={t(nameZhKey)} />
                  </TableCell>
                  {withColor && (
                    <TableCell className="p-1.5">
                      <Input type="color" value={editColor} onChange={(e) => setEditColor(e.target.value)} className="w-16 p-1" aria-label={t("catalog.field.color")} />
                    </TableCell>
                  )}
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
                        onClick={() => run(() => updateCatalogItemAction(item.id, { nameVi: editVi, nameZh: editZh, ...extra(editCode, editColor) }), () => setEditingId(null))}
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
                  {withCode && <TableCell className="py-2">{item.code || "—"}</TableCell>}
                  <TableCell className="py-2 font-medium whitespace-normal">{item.nameVi}</TableCell>
                  <TableCell className="py-2 whitespace-normal text-muted-foreground">{item.nameZh || "—"}</TableCell>
                  {withColor && (
                    <TableCell className="py-2">
                      <span className="inline-block h-5 w-10 rounded border" style={{ backgroundColor: item.color ?? "transparent" }} title={item.color ?? ""} />
                    </TableCell>
                  )}
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
                <TableCell colSpan={4 + extraCols} className="py-6 text-center text-sm text-muted-foreground">
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
        description={t(deleteConfirmKey)}
        confirmLabel={t("common.delete")}
        pending={pending}
        onConfirm={() => deleteId && run(() => deleteCatalogItemAction(deleteId))}
      />
    </Card>
  );
}
