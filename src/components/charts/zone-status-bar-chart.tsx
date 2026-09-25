"use client";

import { Bar, BarChart, CartesianGrid, LabelList, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer } from "@/components/ui/chart";
import { useT } from "@/lib/i18n/locale-context";
import type { DictionaryKey } from "@/lib/i18n/translate";

export type ZoneStatusDatum = { key: string; sufficient: number; needsUpdate: number; expired: number };

const SERIES = [
  { key: "sufficient" as const, color: "var(--success)", labelKey: "records.kpi.sufficient" as const },
  { key: "needsUpdate" as const, color: "var(--warning)", labelKey: "records.kpi.needsUpdate" as const },
  { key: "expired" as const, color: "var(--destructive)", labelKey: "records.kpi.expired" as const },
];

type TooltipPayloadEntry = { payload?: ZoneStatusDatum };

function StatusTooltip({
  active,
  payload,
  label,
  labels,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
  labels: Record<(typeof SERIES)[number]["key"], string>;
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return (
    <div className="rounded-lg border border-border/50 bg-popover px-3 py-2 text-xs shadow-xl">
      <p className="mb-1 font-medium text-popover-foreground">{label}</p>
      {SERIES.map((s) => (
        <p key={s.key} className="flex items-center gap-1.5 text-muted-foreground">
          <span className="inline-block size-2 shrink-0 rounded-[2px]" style={{ backgroundColor: s.color }} />
          {labels[s.key]}: <span className="font-mono font-medium text-foreground">{row[s.key].toLocaleString("vi-VN")}</span>
        </p>
      ))}
    </div>
  );
}

/** Stacked bar per zone (Khu), one segment per completeness/expiry status — mutually exclusive
 *  per record so segment heights sum to that zone's total, unlike the KPI cards above (which
 *  track sufficiency and expiry as independent axes). */
export function ZoneStatusBarChart({
  titleKey,
  data,
  className,
  chartHeight = 220,
}: {
  titleKey: DictionaryKey;
  data: ZoneStatusDatum[];
  className?: string;
  /** Plot height in px — the dashboard passes a taller one so it lines up with its row's donut. */
  chartHeight?: number;
}) {
  const t = useT();
  const labels = { sufficient: t("records.kpi.sufficient"), needsUpdate: t("records.kpi.needsUpdate"), expired: t("records.kpi.expired") };

  // Counts are printed on the segments themselves; ones too thin to hold a legible number are
  // left to the hover tooltip instead of overlapping their neighbours.
  const maxTotal = Math.max(1, ...data.map((d) => d.sufficient + d.needsUpdate + d.expired));
  const formatCount = (value: unknown) => (typeof value === "number" && value >= maxTotal * 0.1 ? value : "");

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{t(titleKey)}</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={{}} className="aspect-auto w-full" style={{ height: chartHeight }}>
          <BarChart data={data} margin={{ left: 4, right: 4, top: 8, bottom: 4 }} accessibilityLayer={false}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/50" />
            <XAxis dataKey="key" tickLine={false} axisLine={false} className="text-xs" />
            <YAxis hide />
            <Tooltip content={<StatusTooltip labels={labels} />} cursor={{ fill: "var(--muted)" }} />
            {SERIES.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                stackId="status"
                fill={s.color}
                barSize={56}
                radius={i === SERIES.length - 1 ? [4, 4, 0, 0] : 0}
              >
                <LabelList dataKey={s.key} position="center" formatter={formatCount} className="fill-white text-[11px] font-semibold" />
              </Bar>
            ))}
          </BarChart>
        </ChartContainer>
        <div className="mt-2 flex items-center justify-center gap-4 text-xs text-muted-foreground">
          {SERIES.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5">
              <span className="inline-block size-2 shrink-0 rounded-[2px]" style={{ backgroundColor: s.color }} />
              {t(s.labelKey)}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
