"use client";

export type ChartDatum = { key: string | null; value: number };
export type BucketedItem = { label: string; rawKey: string | null; value: number; isOther: boolean };

/** Buckets a sorted-desc {key,value}[] into the top N entries plus an "other" bucket
 *  summing the rest — keeps charts a fixed size regardless of how many categories exist. */
export function bucketTopN(data: ChartDatum[], n: number, unspecifiedLabel: string, otherLabel: string): { items: BucketedItem[]; total: number } {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const top = data.slice(0, n).map((d) => ({ label: d.key ?? unspecifiedLabel, rawKey: d.key, value: d.value, isOther: false }));
  const restValue = data.slice(n).reduce((sum, d) => sum + d.value, 0);
  const items = restValue > 0 ? [...top, { label: otherLabel, rawKey: null, value: restValue, isOther: true }] : top;
  return { items, total };
}

export const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
export function colorForIndex(i: number) {
  return CHART_COLORS[i % CHART_COLORS.length];
}

/** Single-hue shade ramps for charts that should read as "one metric, one color family"
 *  (Department = safety/green, Category = data/blue) rather than a rainbow per bar. */
export const GREEN_SHADES = ["#22c55e", "#4ade80", "#16a34a", "#86efac", "#15803d", "#bbf7d0", "#166534", "#dcfce7"];
export const BLUE_SHADES = ["#3b82f6", "#60a5fa", "#2563eb", "#93c5fd", "#1d4ed8", "#bfdbfe", "#1e40af", "#dbeafe"];

type TooltipPayloadEntry = { value?: number | string; payload?: { label?: string } };

/** Shared bar/donut tooltip: name, count, and share of the chart's total. */
export function PercentTooltip({
  active,
  payload,
  total,
  countLabel,
  percentLabel,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  total: number;
  countLabel: string;
  percentLabel: string;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  const value = typeof item.value === "number" ? item.value : 0;
  const percent = total > 0 ? ((value / total) * 100).toFixed(1) : "0.0";
  const label = item.payload?.label ?? "";
  return (
    <div className="rounded-lg border border-border/50 bg-popover px-3 py-2 text-xs shadow-xl">
      <p className="mb-1 font-medium text-popover-foreground">{label}</p>
      <p className="text-muted-foreground">
        {countLabel}: <span className="font-mono font-medium text-foreground">{value.toLocaleString("vi-VN")}</span>
      </p>
      <p className="text-muted-foreground">
        {percentLabel}: <span className="font-mono font-medium text-foreground">{percent}%</span>
      </p>
    </div>
  );
}

/** Trend-chart tooltip: month + a single formatted value (count or cost). */
export function TrendTooltip({
  active,
  payload,
  label,
  valueLabel,
  formatValue,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
  valueLabel: string;
  formatValue?: (value: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const value = typeof payload[0].value === "number" ? payload[0].value : 0;
  return (
    <div className="rounded-lg border border-border/50 bg-popover px-3 py-2 text-xs shadow-xl">
      <p className="mb-1 font-medium text-popover-foreground">{label}</p>
      <p className="text-muted-foreground">
        {valueLabel}: <span className="font-mono font-medium text-foreground">{formatValue ? formatValue(value) : value.toLocaleString("vi-VN")}</span>
      </p>
    </div>
  );
}
