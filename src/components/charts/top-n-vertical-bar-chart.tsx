"use client";

import { Bar, BarChart, CartesianGrid, Cell, LabelList, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer } from "@/components/ui/chart";
import { useT } from "@/lib/i18n/locale-context";
import type { DictionaryKey } from "@/lib/i18n/translate";
import { CHART_BRAND, type ChartDatum } from "./chart-utils";
import { useDrillDown } from "./use-drill-down";
import { ViewAllDialog } from "./view-all-dialog";

// Fixed width per bar (bar + label spacing) — the chart area scrolls horizontally instead of
// squeezing every category into the card width, matching the Employees department chart.
const ITEM_WIDTH = 68;

type Item = { label: string; rawKey: string | null; value: number };
type TickProps = { x?: number; y?: number; payload?: { value?: string } };
type LabelProps = { x?: number; y?: number; value?: React.ReactNode; index?: number };

/** Vertical-bar variant of TopNBarChart — shows every category (no top-N/"Khác" bucketing,
 *  since the horizontal scroll track already lets users reach every bar), same
 *  data/drill-down/CHART_BRAND color, angled clickable labels like the Employees chart. */
export function TopNVerticalBarChart({
  titleKey,
  data,
  filterParam,
  resolveMap,
}: {
  titleKey: DictionaryKey;
  data: ChartDatum[];
  filterParam?: string;
  resolveMap?: Record<string, string>;
}) {
  const t = useT();
  const title = t(titleKey);
  const navigate = useDrillDown(filterParam);
  const clickable = Boolean(navigate);

  function handleClick(item: Item) {
    if (!navigate || item.rawKey === null) return;
    const value = resolveMap ? resolveMap[item.rawKey] : item.rawKey;
    if (value) navigate(value);
  }

  const items: Item[] = data.map((d) => ({ label: d.key ?? t("incidents.chart.unspecified"), rawKey: d.key, value: d.value }));

  // Same short bar / small value problem as the Employees chart — the name label and the
  // value-on-top label are each their own click target wired to the same handler as the bar.
  function CategoryTick({ x = 0, y = 0, payload }: TickProps) {
    const item = items.find((i) => i.label === payload?.value);
    return (
      <text
        x={x}
        y={y}
        dy={8}
        textAnchor="end"
        transform={`rotate(-35, ${x}, ${y})`}
        onClick={() => item && handleClick(item)}
        tabIndex={-1}
        className={`text-[10px] fill-muted-foreground outline-none ${clickable ? "cursor-pointer" : ""}`}
      >
        {payload?.value ?? ""}
      </text>
    );
  }

  function ValueLabel({ x = 0, y = 0, value, index = 0 }: LabelProps) {
    const item = items[index];
    return (
      <text
        x={x}
        y={y - 6}
        textAnchor="middle"
        onClick={() => item && handleClick(item)}
        tabIndex={-1}
        className={`text-[10px] font-medium fill-foreground outline-none ${clickable ? "cursor-pointer" : ""}`}
      >
        {value}
      </text>
    );
  }

  return (
    <Card>
      <CardHeader className="flex items-center justify-between gap-2 pb-2">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
        <ViewAllDialog title={title} rows={data} />
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="h-[260px]" style={{ minWidth: `${items.length * ITEM_WIDTH}px` }}>
            <ChartContainer config={{}} className="aspect-auto h-full w-full">
              <BarChart data={items} margin={{ top: 20, right: 8, left: 8, bottom: 44 }} barCategoryGap={16} accessibilityLayer={false}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} interval={0} height={50} tick={<CategoryTick />} />
                <YAxis hide domain={[0, (max: number) => max * 1.15]} />
                <Bar dataKey="value" radius={3} barSize={18}>
                  {items.map((item) => (
                    <Cell
                      key={item.label}
                      fill={CHART_BRAND}
                      className={clickable ? "cursor-pointer" : undefined}
                      onClick={() => handleClick(item)}
                    />
                  ))}
                  <LabelList dataKey="value" content={<ValueLabel />} />
                </Bar>
              </BarChart>
            </ChartContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
