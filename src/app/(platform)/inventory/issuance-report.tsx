"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ColumnVisibilityMenu } from "@/components/ui/column-visibility-menu";
import { IssuanceTable, type IssuanceRow } from "./issuance-table";
import { ISSUANCE_COLUMNS_COOKIE, ISSUANCE_TOGGLEABLE_COLUMNS } from "./column-visibility";
import type { WorkshopOption } from "./item-card";
import { useT } from "@/lib/i18n/locale-context";
import type { Locale } from "@/lib/i18n/translate";

export type IssuedItemView = {
  id: string;
  name: string;
  imageUrl: string | null;
  unit: string;
  totalIssued: number;
};

const BAR_HEIGHT_PX = 100;

export function IssuanceReport({
  chartItems,
  rows,
  locale,
  canEdit,
  canDelete,
  workshops,
  hiddenColumns,
}: {
  chartItems: IssuedItemView[];
  rows: IssuanceRow[];
  locale: Locale;
  canEdit: boolean;
  canDelete: boolean;
  workshops: WorkshopOption[];
  hiddenColumns: string[];
}) {
  const t = useT();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const maxIssued = Math.max(...chartItems.map((i) => i.totalIssued), 1);
  const selectedItem = chartItems.find((i) => i.id === selectedId) ?? null;
  const visibleRows = useMemo(() => (selectedId ? rows.filter((r) => r.item.id === selectedId) : rows), [rows, selectedId]);

  return (
    <div className="flex flex-col gap-4">
      {chartItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">{t("inventory.issuance.chart.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              {chartItems.map((item) => {
                const percent = (item.totalIssued / maxIssued) * 100;
                const active = item.id === selectedId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedId(active ? null : item.id)}
                    className={"flex w-16 shrink-0 flex-col items-center gap-1.5 rounded-md p-1 outline-none " + (active ? "bg-accent" : "hover:bg-accent/50")}
                  >
                    <span className="text-xs font-semibold">{item.totalIssued}</span>
                    <div className="relative flex items-end justify-center" style={{ height: BAR_HEIGHT_PX, width: 28 }}>
                      <div
                        className={"w-full rounded-t-sm " + (active ? "bg-destructive" : "bg-[var(--chart-brand)]")}
                        style={{ height: `${Math.max(percent, 2)}%` }}
                      />
                    </div>
                    <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-md border bg-white">
                      {item.imageUrl && <Image src={item.imageUrl} alt={item.name} width={36} height={36} className="h-full w-full object-contain" />}
                    </div>
                    <span className="line-clamp-2 text-center text-[10px] leading-tight text-muted-foreground">{item.name}</span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-base font-semibold">{t("inventory.issuance.title")}</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            {selectedItem && (
              <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => setSelectedId(null)}>
                {selectedItem.name}
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
            <ColumnVisibilityMenu columns={ISSUANCE_TOGGLEABLE_COLUMNS} hiddenColumns={hiddenColumns} cookieName={ISSUANCE_COLUMNS_COOKIE} />
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <IssuanceTable rows={visibleRows} locale={locale} canEdit={canEdit} canDelete={canDelete} workshops={workshops} hiddenColumns={hiddenColumns} />
        </CardContent>
      </Card>
    </div>
  );
}
