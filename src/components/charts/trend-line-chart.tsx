"use client";

import { Area, AreaChart, CartesianGrid, LabelList, Tooltip, XAxis, YAxis, type RenderableText } from "recharts";
import { ChartContainer } from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocale, useT } from "@/lib/i18n/locale-context";
import type { DictionaryKey } from "@/lib/i18n/translate";
import { TrendTooltip } from "./chart-utils";

function monthTick(month: string) {
  const [, mm] = month.split("-");
  return String(Number(mm));
}

export function TrendLineChart({
  titleKey,
  data,
  metric,
}: {
  titleKey: DictionaryKey;
  data: { month: string; value: number }[];
  metric: "count" | "cost";
}) {
  const t = useT();
  const { locale } = useLocale();
  // The number *formatting* (grouping, compact-unit convention) follows the current UI
  // language so it switches instantly with VI⇄中文 — the "₫" currency suffix stays put
  // either way since it names the actual currency, not the UI language.
  const intlLocale = locale === "zh" ? "zh-CN" : "vi-VN";
  const valueLabel = metric === "cost" ? t("incidents.kpi.totalCost") : t("incidents.chart.count");
  const fullCost = new Intl.NumberFormat(intlLocale, { maximumFractionDigits: 0 });
  const formatValue = metric === "cost" ? (v: number) => `${fullCost.format(Math.round(v))} ₫` : undefined;
  // Incident-count trend reads as "safety" (green); cost trend reads as "data" (blue).
  const color = metric === "cost" ? "var(--chart-2)" : "var(--chart-1)";
  const gradientId = `trend-fill-${metric}`;

  // Data labels must be readable directly on the chart (screenshot/report use case) — the
  // tooltip stays only for the full-precision cost value. Cost labels use compact notation
  // (e.g. "2,3tr ₫" in Vietnamese, "230万 ₫" in Chinese) since 12 full VND figures side-by-side
  // would overlap/overflow.
  const compactCost = new Intl.NumberFormat(intlLocale, { notation: "compact", maximumFractionDigits: 1 });
  const formatLabel = (raw: RenderableText) => {
    const value = typeof raw === "number" ? raw : Number(raw ?? 0);
    if (metric === "count") return value === 0 ? "" : String(value);
    return value === 0 ? "" : `${compactCost.format(value)} ₫`;
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{t(titleKey)}</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={{}} className="aspect-auto h-[240px] w-full">
          <AreaChart data={data} margin={{ left: 4, right: 12, top: 22, bottom: 4 }} accessibilityLayer={false}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.24} />
                <stop offset="95%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/50" />
            <XAxis dataKey="month" tickFormatter={monthTick} tickLine={false} axisLine={false} className="text-xs" />
            <YAxis hide />
            <Tooltip content={<TrendTooltip valueLabel={valueLabel} formatValue={formatValue} />} />
            <Area
              type="linear"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              dot={{ r: 3, strokeWidth: 0, fill: color }}
              activeDot={{ r: 4 }}
            >
              <LabelList dataKey="value" position="top" offset={8} formatter={formatLabel} className="fill-foreground text-[10px] font-medium" />
            </Area>
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
