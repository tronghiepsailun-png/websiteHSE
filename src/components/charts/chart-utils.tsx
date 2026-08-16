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

// One HSE green for every non-semantic distribution/category chart across the whole app
// (Incidents, Employees, PCCC, and any future module) — never a per-bar rainbow. Red/amber
// stay reserved for genuine risk meaning (severity, overdue, expired), passed in separately
// via each chart's own colorMap, not through this default.
export const CHART_BRAND = "var(--chart-brand)";

// Rank-based opacity only — same hue throughout, just lighter for lower-ranked segments.
// Bar charts don't need this (bar length already encodes rank) and pass 1 for every item;
// donut/pie segments use it since adjacent wedges of the exact same solid color would be
// hard to tell apart at a glance.
const BRAND_OPACITY_RAMP = [1, 0.82, 0.68, 0.56, 0.46, 0.38, 0.32, 0.26];
export function chartBrandOpacity(i: number) {
  return BRAND_OPACITY_RAMP[Math.min(i, BRAND_OPACITY_RAMP.length - 1)];
}

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
