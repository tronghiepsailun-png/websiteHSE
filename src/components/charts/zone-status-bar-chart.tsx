"use client";

import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
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

/** Stacked bar per zone (Khu), one segment per completeness/expiry status — mutually exclusive
 *  per record so segment heights sum to that zone's total, unlike the KPI cards above (which
 *  track sufficiency and expiry as independent axes). */
export function ZoneStatusBarChart({ titleKey, data }: { titleKey: DictionaryKey; data: ZoneStatusDatum[] }) {
  const t = useT();

  function StatusTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayloadEntry[]; label?: string }) {
    const row = payload?.[0]?.payload;
    if (!active || !row) return null;
    return (
      <div className="rounded-lg border border-border/50 bg-popover px-3 py-2 text-xs shadow-xl">
        <p className="mb-1 font-medium text-popover-foreground">{label}</p>
        {SERIES.map((s) => (
          <p key={s.key} className="flex items-center gap-1.5 text-muted-foreground">
            <span className="inline-block size-2 shrink-0 rounded-[2px]" style={{ backgroundColor: s.color }} />
            {t(s.labelKey)}: <span className="font-mono font-medium text-foreground">{row[s.key].toLocaleString("vi-VN")}</span>
          </p>
        ))}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{t(titleKey)}</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={{}} className="aspect-auto h-[220px] w-full">
          <BarChart data={data} margin={{ left: 4, right: 4, top: 8, bottom: 4 }} accessibilityLayer={false}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/50" />
            <XAxis dataKey="key" tickLine={false} axisLine={false} className="text-xs" />
            <YAxis hide />
            <Tooltip content={<StatusTooltip />} cursor={{ fill: "var(--muted)" }} />
            {SERIES.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                stackId="status"
                fill={s.color}
                barSize={56}
                radius={i === SERIES.length - 1 ? [4, 4, 0, 0] : 0}
              />
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
