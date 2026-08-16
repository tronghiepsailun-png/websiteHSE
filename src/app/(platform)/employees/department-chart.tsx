"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer } from "@/components/ui/chart";
import { useT } from "@/lib/i18n/locale-context";
import { bucketTopN, GREEN_SHADES, type ChartDatum } from "@/components/charts/chart-utils";

const TOP_N = 8;

export function DepartmentChart({
  data,
  total,
  selected,
}: {
  data: { name: string; count: number }[];
  total: number;
  selected?: string;
}) {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleClick(name: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (selected === name) {
      next.delete("orgUnitLevel2");
    } else {
      next.set("orgUnitLevel2", name);
    }
    next.delete("page");
    router.push(`/employees?${next.toString()}`);
  }

  if (data.length === 0) return null;

  const chartData: ChartDatum[] = data.map((d) => ({ key: d.name, value: d.count }));
  const { items } = bucketTopN(chartData, TOP_N, t("incidents.chart.unspecified"), t("incidents.chart.other"));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{t("employees.chart.byDepartment")}</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={{}} className="aspect-auto h-[220px] w-full">
          <BarChart data={items} margin={{ top: 20, right: 8, left: 8, bottom: 4 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/50" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} interval={0} className="text-xs" />
            <YAxis hide domain={[0, (max: number) => max * 1.15]} />
            <Bar dataKey="value" radius={4} barSize={32}>
              {items.map((item, i) => (
                <Cell
                  key={item.label}
                  fill={item.isOther ? "var(--muted-foreground)" : GREEN_SHADES[i % GREEN_SHADES.length]}
                  fillOpacity={!selected || selected === item.rawKey ? 1 : 0.35}
                  className={!item.isOther ? "cursor-pointer" : undefined}
                  onClick={() => !item.isOther && handleClick(item.label)}
                />
              ))}
              <LabelList dataKey="value" position="top" offset={6} className="fill-foreground text-[11px] font-medium" />
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
