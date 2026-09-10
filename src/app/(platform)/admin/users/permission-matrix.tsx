"use client";

import { useState } from "react";
import { PERMISSION_MODULES, ALWAYS_GRANTED_PERMISSIONS, type PermissionModule } from "@/server/permissions";
import { useT } from "@/lib/i18n/locale-context";
import type { DictionaryKey } from "@/lib/i18n/translate";
import { Button } from "@/components/ui/button";

type ColumnKey = "view" | "edit" | "delete" | "upload" | "download";
const COLUMNS: { key: ColumnKey; labelKey: DictionaryKey }[] = [
  { key: "view", labelKey: "admin.users.colView" },
  { key: "edit", labelKey: "admin.users.colEdit" },
  { key: "delete", labelKey: "admin.users.colDelete" },
  { key: "upload", labelKey: "admin.users.colUpload" },
  { key: "download", labelKey: "admin.users.colDownload" },
];

function columnKeys(mod: PermissionModule, column: ColumnKey): string[] | null {
  if (column === "view") return mod.view ? [mod.view] : null;
  return mod[column];
}

function isColumnChecked(mod: PermissionModule, column: ColumnKey, selected: Set<string>) {
  const keys = columnKeys(mod, column);
  return keys !== null && keys.length > 0 && keys.every((k) => selected.has(k));
}

// Edit/delete/upload/download are meaningless without also being able to see the module, so
// "Xem" auto-checks alongside them and can't be independently unchecked while any of them
// still are — matching how the underlying page-level access gate actually works.
function otherColumnsChecked(mod: PermissionModule, selected: Set<string>) {
  return (["edit", "delete", "upload", "download"] as const).some((c) => isColumnChecked(mod, c, selected));
}

// Per-module permission grid — 5 independent columns (Xem/Sửa/Xóa/Tải lên/Tải xuống), each
// backed by a real, separately-enforced permission key (or several bundled behind one
// checkbox, e.g. Incident's "Sửa" covers both create and edit). A blank cell means that
// action genuinely doesn't exist for this module (e.g. CAPA is never hard-deleted) — showing
// a checkbox there would just be decorative, since nothing in the app checks it.
export function PermissionMatrix({ defaultSelected = [] }: { defaultSelected?: string[] }) {
  const t = useT();
  const [selected, setSelected] = useState<Set<string>>(new Set(defaultSelected));

  function toggle(mod: PermissionModule, column: ColumnKey) {
    if (column === "view" && otherColumnsChecked(mod, selected)) return; // locked on while a dependent column is checked
    const keys = columnKeys(mod, column);
    if (!keys) return;
    setSelected((prev) => {
      const next = new Set(prev);
      const checked = isColumnChecked(mod, column, prev);
      for (const k of keys) {
        if (checked) next.delete(k);
        else next.add(k);
      }
      // Every other column implies "view" — no point granting edit/delete/upload/download
      // without also being able to see the module in the first place.
      if (!checked && mod.view) next.add(mod.view);
      return next;
    });
  }

  function grantAll() {
    const all = new Set<string>(ALWAYS_GRANTED_PERMISSIONS);
    for (const mod of PERMISSION_MODULES) {
      for (const col of COLUMNS) {
        const keys = columnKeys(mod, col.key);
        if (keys) for (const k of keys) all.add(k);
      }
    }
    setSelected(all);
  }

  function clearAll() {
    setSelected(new Set());
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={grantAll}>
          {t("admin.users.grantAll")}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={clearAll}>
          {t("admin.users.clearAll")}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="min-w-[180px] px-3 py-2 text-left font-medium whitespace-nowrap">{t("admin.users.colModule")}</th>
              {COLUMNS.map((col) => (
                <th key={col.key} className="w-24 px-2 py-2 text-center font-medium whitespace-nowrap">
                  {t(col.labelKey)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {PERMISSION_MODULES.map((mod) => (
              <tr key={mod.key}>
                <td className="px-3 py-2 whitespace-nowrap">
                  {t(mod.labelKey as DictionaryKey)}
                  {mod.key === "users" && (
                    <p className="text-xs whitespace-normal text-destructive">{t("admin.users.usersModuleWarning")}</p>
                  )}
                </td>
                {COLUMNS.map((col) => {
                  const keys = columnKeys(mod, col.key);
                  const locked = col.key === "view" && otherColumnsChecked(mod, selected);
                  return (
                    <td key={col.key} className="px-2 py-2 text-center">
                      {keys && (
                        <input
                          type="checkbox"
                          checked={isColumnChecked(mod, col.key, selected) || locked}
                          disabled={locked}
                          onChange={() => toggle(mod, col.key)}
                          className="size-4 accent-primary"
                        />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {[...selected].map((p) => (
        <input key={p} type="hidden" name="permissions" value={p} />
      ))}
    </div>
  );
}
