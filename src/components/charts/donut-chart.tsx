"use client";

import { Cell, Pie, PieChart, Tooltip } from "recharts";
import { ChartContainer } from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useT } from "@/lib/i18n/locale-context";
import type { DictionaryKey } from "@/lib/i18n/translate";
import { bucketTopN, chartBrandOpacity, CHART_BRAND, PercentTooltip, type BucketedItem, type ChartDatum } from "./chart-utils";
import { useDrillDown } from "./use-drill-down";
import { ViewAllDialog } from "./view-all-dialog";

export function DonutChart({
  titleKey,
  data,
  topN,
  filterParam,
  resolveMap,
  colorMap,
}: {
  titleKey: DictionaryKey;
  data: ChartDatum[];
  topN: number;
  filterParam?: string;
  /** Maps a chart label (e.g. an org unit name) to the id the list filter actually needs.
   *  Omit when the label itself is already the filter value (e.g. injured body part). */
  resolveMap?: Record<string, string>;
  /** Exact per-label color (e.g. each severity's own tenant-configured colorHex) — takes
   *  priority over the default cycling palette. Segments with no entry fall back to it. */
  colorMap?: Record<string, string>;
}) {
  const t = useT();
  const title = t(titleKey);
  const { items, total } = bucketTopN(data, topN, t("incidents.chart.unspecified"), t("incidents.chart.other"));
  const maxValue = Math.max(1, ...items.map((i) => i.value));
  const navigate = useDrillDown(filterParam);
  const clickable = Boolean(navigate);
  // Segments with a real semantic color (e.g. each severity's own configured colorHex) render
  // solid — that color carries actual risk meaning. Everything else falls back to the shared
  // HSE-green brand hue, ranked by opacity only, so unrelated categorical charts (injured body
  // part, etc.) never turn into a decorative rainbow.
  function colorAt(item: BucketedItem, i: number): { fill: string; opacity: number } {
    const semantic = item.rawKey && colorMap?.[item.rawKey];
    return semantic ? { fill: semantic, opacity: 1 } : { fill: CHART_BRAND, opacity: chartBrandOpacity(i) };
  }

  function handleClick(item: BucketedItem) {
    if (!navigate || item.isOther || item.rawKey === null) return;
    const value = resolveMap ? resolveMap[item.rawKey] : item.rawKey;
    if (value) navigate(value);
  }

  return (
    <Card>
      <CardHeader className="flex items-center justify-between gap-2 pb-2">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
        <ViewAllDialog title={title} rows={data} />
      </CardHeader>
      <CardContent className="flex items-center gap-4">
        <div className="relative h-[150px] w-[150px] shrink-0">
          <ChartContainer config={{}} className="aspect-auto h-full w-full">
            <PieChart accessibilityLayer={false}>
              <Tooltip content={<PercentTooltip total={total} countLabel={t("incidents.chart.count")} percentLabel={t("incidents.chart.percent")} />} />
              <Pie data={items} dataKey="value" nameKey="label" innerRadius={44} outerRadius={68} paddingAngle={2} strokeWidth={2}>
                {items.map((item, i) => {
                  const { fill, opacity } = item.isOther ? { fill: "var(--muted-foreground)", opacity: 1 } : colorAt(item, i);
                  return (
                    <Cell
                      key={item.label}
                      fill={fill}
                      fillOpacity={opacity}
                      className={clickable && !item.isOther ? "cursor-pointer" : undefined}
                      onClick={() => handleClick(item)}
                    />
                  );
                })}
              </Pie>
            </PieChart>
          </ChartContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-semibold text-foreground">{total.toLocaleString("vi-VN")}</span>
            <span className="text-[11px] text-muted-foreground">{t("incidents.chart.count")}</span>
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {items.map((item, i) => {
            const { fill, opacity } = item.isOther ? { fill: "var(--muted-foreground)", opacity: 1 } : colorAt(item, i);
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => handleClick(item)}
                disabled={item.isOther || !clickable}
                className="group flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-xs enabled:hover:bg-muted disabled:cursor-default"
              >
                <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: fill, opacity }} />
                <span className="w-14 shrink-0 truncate text-left text-muted-foreground">{item.label}</span>
                <span className="h-1.5 min-w-8 flex-1 overflow-hidden rounded-full bg-muted">
                  <span className="block h-full rounded-full" style={{ width: `${(item.value / maxValue) * 100}%`, backgroundColor: fill, opacity }} />
                </span>
                <span className="w-8 shrink-0 text-right font-mono font-medium text-foreground">{item.value}</span>
                <span className="w-9 shrink-0 text-right font-mono text-muted-foreground">{total > 0 ? ((item.value / total) * 100).toFixed(0) : 0}%</span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
