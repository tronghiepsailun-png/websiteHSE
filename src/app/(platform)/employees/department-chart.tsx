"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer } from "@/components/ui/chart";
import { useT } from "@/lib/i18n/locale-context";
import { GREEN_SHADES } from "@/components/charts/chart-utils";

// Fixed width per bar (bar + label spacing) — the chart area scrolls horizontally instead of
// squeezing every department into the card width, so all of them stay legible.
const ITEM_WIDTH = 52;

export function DepartmentChart({
  data,
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

  const chartData = data.map((d) => ({ label: d.name, value: d.count }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{t("employees.chart.byDepartment")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="h-[220px]" style={{ minWidth: `${chartData.length * ITEM_WIDTH}px` }}>
            <ChartContainer config={{}} className="aspect-auto h-full w-full">
              <BarChart data={chartData} margin={{ top: 20, right: 8, left: 8, bottom: 4 }} barCategoryGap={6}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} interval={0} className="text-[10px]" />
                <YAxis hide domain={[0, (max: number) => max * 1.15]} />
                <Bar dataKey="value" radius={3} barSize={18}>
                  {chartData.map((item, i) => (
                    <Cell
                      key={item.label}
                      fill={GREEN_SHADES[i % GREEN_SHADES.length]}
                      fillOpacity={!selected || selected === item.label ? 1 : 0.35}
                      className="cursor-pointer"
                      onClick={() => handleClick(item.label)}
                    />
                  ))}
                  <LabelList dataKey="value" position="top" offset={6} className="fill-foreground text-[10px] font-medium" />
                </Bar>
              </BarChart>
            </ChartContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
