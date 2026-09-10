"use client";

import { Bar, BarChart, CartesianGrid, Cell, LabelList, Tooltip, XAxis, YAxis } from "recharts";
import { ChartContainer } from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useT } from "@/lib/i18n/locale-context";
import type { DictionaryKey } from "@/lib/i18n/translate";
import { bucketTopN, CHART_BRAND, PercentTooltip, type BucketedItem, type ChartDatum } from "./chart-utils";
import { useDrillDown } from "./use-drill-down";
import { ViewAllDialog } from "./view-all-dialog";

export function TopNBarChart({
  titleKey,
  data,
  topN,
  filterParam,
  resolveMap,
  labelWidth = 110,
}: {
  titleKey: DictionaryKey;
  data: ChartDatum[];
  topN: number;
  filterParam?: string;
  /** Maps a chart label (e.g. an org unit name) to the id the list filter actually needs.
   *  Omit when the label itself is already the filter value (e.g. injured body part). */
  resolveMap?: Record<string, string>;
  /** Y-axis category column width in px — widen for charts whose labels run longer than a
   *  department/severity name (e.g. full violation-content sentences). */
  labelWidth?: number;
}) {
  const t = useT();
  const title = t(titleKey);
  const { items, total } = bucketTopN(data, topN, t("incidents.chart.unspecified"), t("incidents.chart.other"));
  const navigate = useDrillDown(filterParam);
  const clickable = Boolean(navigate);

  // Count + share must be readable directly on the bar (screenshot/report use case), not
  // only via hover — precomputed per item so LabelList can render it with no formatter.
  const chartData = items.map((item) => ({
    ...item,
    labelText: `${item.value} (${total > 0 ? ((item.value / total) * 100).toFixed(0) : 0}%)`,
  }));

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
      <CardContent>
        <ChartContainer config={{}} className="aspect-auto h-[220px] w-full">
          <BarChart data={chartData} layout="vertical" margin={{ left: 4, right: 44, top: 4, bottom: 4 }} accessibilityLayer={false}>
            <CartesianGrid horizontal={false} strokeDasharray="3 3" className="stroke-border/50" />
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="label" width={labelWidth} tickLine={false} axisLine={false} className="text-xs" interval={0} />
            <Tooltip
              cursor={{ fill: "var(--muted)" }}
              content={<PercentTooltip total={total} countLabel={t("incidents.chart.count")} percentLabel={t("incidents.chart.percent")} />}
            />
            <Bar dataKey="value" radius={4} barSize={14}>
              {items.map((item) => (
                <Cell
                  key={item.label}
                  fill={item.isOther ? "var(--muted-foreground)" : CHART_BRAND}
                  className={clickable && !item.isOther ? "cursor-pointer" : undefined}
                  onClick={() => handleClick(item)}
                />
              ))}
              <LabelList dataKey="labelText" position="right" offset={6} className="fill-foreground text-[11px] font-medium" />
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
