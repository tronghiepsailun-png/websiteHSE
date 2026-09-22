"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ColumnVisibilityMenu } from "@/components/ui/column-visibility-menu";
import { TablePagination } from "@/components/ui/table-pagination";
import { StockInTable, type StockInRow } from "./stockin-table";
import { STOCKIN_COLUMNS_COOKIE, STOCKIN_TOGGLEABLE_COLUMNS } from "./column-visibility";
import { useT } from "@/lib/i18n/locale-context";
import type { Locale } from "@/lib/i18n/translate";

export type ReceivedItemView = {
  id: string;
  name: string;
  imageUrl: string | null;
  unit: string;
  totalReceived: number;
};

const BAR_HEIGHT_PX = 100;
const PAGE_SIZE = 20;

export function StockInReport({
  chartItems,
  rows,
  locale,
  canEdit,
  canDelete,
  hiddenColumns,
}: {
  chartItems: ReceivedItemView[];
  rows: StockInRow[];
  locale: Locale;
  canEdit: boolean;
  canDelete: boolean;
  hiddenColumns: string[];
}) {
  const t = useT();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ page: 1, viewAll: false });

  const maxReceived = Math.max(...chartItems.map((i) => i.totalReceived), 1);
  const selectedItem = chartItems.find((i) => i.id === selectedId) ?? null;
  const filteredRows = useMemo(() => (selectedId ? rows.filter((r) => r.item.id === selectedId) : rows), [rows, selectedId]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const page = Math.min(pagination.page, totalPages);
  const visibleRows = pagination.viewAll ? filteredRows : filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function selectItem(id: string | null) {
    setSelectedId(id);
    setPagination((prev) => ({ ...prev, page: 1 }));
  }

  return (
    <div className="flex flex-col gap-4">
      {chartItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">{t("inventory.stockIn.chart.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              {chartItems.map((item) => {
                const percent = (item.totalReceived / maxReceived) * 100;
                const active = item.id === selectedId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectItem(active ? null : item.id)}
                    className={"flex w-16 shrink-0 flex-col items-center gap-1.5 rounded-md p-1 outline-none " + (active ? "bg-accent" : "hover:bg-accent/50")}
                  >
                    <span className="text-xs font-semibold">{item.totalReceived}</span>
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
          <CardTitle className="text-base font-semibold">{t("inventory.stockIn.title")}</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            {selectedItem && (
              <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => selectItem(null)}>
                {selectedItem.name}
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
            <ColumnVisibilityMenu columns={STOCKIN_TOGGLEABLE_COLUMNS} hiddenColumns={hiddenColumns} cookieName={STOCKIN_COLUMNS_COOKIE} />
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <StockInTable rows={visibleRows} locale={locale} canEdit={canEdit} canDelete={canDelete} hiddenColumns={hiddenColumns} />
          <TablePagination
            total={filteredRows.length}
            page={page}
            pageSize={PAGE_SIZE}
            viewAll={pagination.viewAll}
            unitLabelKey="inventory.unitLabel"
            onChange={setPagination}
          />
        </CardContent>
      </Card>
    </div>
  );
}
