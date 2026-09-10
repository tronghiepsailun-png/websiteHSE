"use client";

import { useRouter } from "next/navigation";
import { Columns3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useT } from "@/lib/i18n/locale-context";
import type { ToggleableColumn } from "@/lib/column-visibility";

/** Generic "which columns show" toggle, backed by a per-table cookie — reused across every big
 *  data list in the app (Incidents, Employees, CAPA, Violations, Inventory...) instead of each
 *  page rolling its own copy. The page itself owns reading the cookie (server-side) and
 *  conditionally rendering each optional TableHead/TableCell; this component only owns the menu
 *  UI and writing the cookie back. */
export function ColumnVisibilityMenu<Id extends string>({
  columns,
  hiddenColumns,
  cookieName,
}: {
  columns: ToggleableColumn<Id>[];
  hiddenColumns: Id[];
  cookieName: string;
}) {
  const t = useT();
  const router = useRouter();
  const hidden = new Set<Id>(hiddenColumns);

  function toggle(id: Id, nextVisible: boolean) {
    const next = new Set(hidden);
    if (nextVisible) next.delete(id);
    else next.add(id);
    document.cookie = `${cookieName}=${[...next].join(",")}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button type="button" variant="outline" size="sm" className="gap-1.5" />}>
        <Columns3 className="size-4" />
        {t("common.tableColumns")}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("common.tableColumns")}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {columns.map((col) => (
            <DropdownMenuCheckboxItem
              key={col.id}
              closeOnClick={false}
              checked={!hidden.has(col.id)}
              onCheckedChange={(checked) => toggle(col.id, checked)}
            >
              {t(col.labelKey)}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
