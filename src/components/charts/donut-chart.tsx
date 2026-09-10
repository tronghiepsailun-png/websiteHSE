"use client";

import { Cell, Pie, PieChart, Tooltip } from "recharts";
import type { PieLabelRenderProps } from "recharts";
import { ChartContainer } from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useT } from "@/lib/i18n/locale-context";
import type { DictionaryKey } from "@/lib/i18n/translate";
import { bucketTopN, chartBrandOpacity, CHART_BRAND, PercentTooltip, type BucketedItem, type ChartDatum } from "./chart-utils";
import { useDrillDown } from "./use-drill-down";
import { ViewAllDialog } from "./view-all-dialog";

const RADIAN = Math.PI / 180;
const INNER_RADIUS = 46;
const OUTER_RADIUS = 70;

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
  const navigate = useDrillDown(filterParam);
  const clickable = Boolean(navigate);
  // Segments with a real semantic color (e.g. each severity's own configured colorHex) render
  // solid — that color carries actual risk meaning. Everything else falls back to the shared
  // HSE-green brand hue, ranked by opacity only, so unrelated categorical charts (injured body
  // part, etc.) never turn into a decorative rainbow.
  function colorAt(item: BucketedItem, i: number): { fill: string; opacity: number } {
    if (item.isOther) return { fill: "var(--muted-foreground)", opacity: 1 };
    const semantic = item.rawKey && colorMap?.[item.rawKey];
    return semantic ? { fill: semantic, opacity: 1 } : { fill: CHART_BRAND, opacity: chartBrandOpacity(i) };
  }

  function handleClick(item: BucketedItem) {
    if (!navigate || item.isOther || item.rawKey === null) return;
    const value = resolveMap ? resolveMap[item.rawKey] : item.rawKey;
    if (value) navigate(value);
  }

  // Leader-line label outside each slice — name + count, connected back to the wedge by a short
  // elbowed line in the wedge's own color, the classic "exploded pie label" pattern. Replaces the
  // old side-by-side progress-bar legend, which wasted a lot of card width on a fixed 56px label
  // column no real label fit into.
  function renderLabel(props: PieLabelRenderProps) {
    const { cx, cy, midAngle, index } = props;
    if (typeof cx !== "number" || typeof cy !== "number" || typeof midAngle !== "number" || index === undefined) return null;
    const item = items[index];
    if (!item) return null;
    const { fill } = colorAt(item, index);

    const sin = Math.sin(-RADIAN * midAngle);
    const cos = Math.cos(-RADIAN * midAngle);
    const sx = cx + (OUTER_RADIUS + 8) * cos;
    const sy = cy + (OUTER_RADIUS + 8) * sin;
    const mx = cx + (OUTER_RADIUS + 26) * cos;
    const my = cy + (OUTER_RADIUS + 26) * sin;
    const ex = mx + (cos >= 0 ? 1 : -1) * 18;
    const ey = my;
    const textAnchor = cos >= 0 ? "start" : "end";

    return (
      <g
        className={clickable && !item.isOther ? "cursor-pointer" : undefined}
        onClick={() => handleClick(item)}
      >
        <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} fill="none" strokeWidth={2} />
        <circle cx={ex} cy={ey} r={3} fill={fill} stroke="none" />
        <text
          x={ex + (cos >= 0 ? 1 : -1) * 7}
          y={ey}
          dy={5}
          textAnchor={textAnchor}
          className="fill-foreground text-[15px] font-semibold"
        >
          {item.label} <tspan className="fill-muted-foreground font-medium">({item.value})</tspan>
        </text>
      </g>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="flex items-center justify-between gap-2 pb-2">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
        <ViewAllDialog title={title} rows={data} />
      </CardHeader>
      <CardContent className="flex flex-1 items-center">
        <div className="relative h-[300px] w-full">
          <ChartContainer config={{}} className="aspect-auto h-full w-full">
            <PieChart accessibilityLayer={false}>
              <Tooltip content={<PercentTooltip total={total} countLabel={t("incidents.chart.count")} percentLabel={t("incidents.chart.percent")} />} />
              <Pie
                data={items}
                dataKey="value"
                nameKey="label"
                innerRadius={INNER_RADIUS}
                outerRadius={OUTER_RADIUS}
                paddingAngle={2}
                strokeWidth={2}
                label={renderLabel}
                labelLine={false}
              >
                {items.map((item, i) => {
                  const { fill, opacity } = colorAt(item, i);
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
      </CardContent>
    </Card>
  );
}
