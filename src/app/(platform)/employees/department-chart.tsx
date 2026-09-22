"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer } from "@/components/ui/chart";
import { useT } from "@/lib/i18n/locale-context";
import { T } from "@/components/i18n/t";
import { CHART_BRAND } from "@/components/charts/chart-utils";
import { DepartmentDetailDialog } from "./department-detail-dialog";
import type { Level1Breakdown } from "@/server/employees";
import { HorizontalScroll } from "@/components/ui/horizontal-scroll";

// Fixed width per bar (bar + gap) — the chart area scrolls horizontally instead of squeezing
// every department into the card width, so all of them stay legible and tappable.
const ITEM_WIDTH = 68;

type TickProps = { x?: number; y?: number; payload?: { value?: string } };
type LabelProps = { x?: number; y?: number; value?: React.ReactNode; index?: number };

export function DepartmentChart({
  data,
  total,
  selected,
  hierarchy,
  defaultOrgUnitLevel1,
}: {
  data: { name: string; count: number }[];
  total: number;
  selected?: string;
  hierarchy: Level1Breakdown[];
  defaultOrgUnitLevel1?: string;
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

  // Custom tick so the department name is angled (avoids adjacent labels running into each
  // other) and clickable — a short bar for a small department can be only a couple of
  // pixels tall, too small to click reliably, so the name and the value-on-top both act as
  // the same click target as the bar itself.
  function DeptTick({ x = 0, y = 0, payload }: TickProps) {
    const name = payload?.value ?? "";
    const isSelected = !selected || selected === name;
    return (
      <text
        x={x}
        y={y}
        dy={8}
        textAnchor="end"
        transform={`rotate(-35, ${x}, ${y})`}
        onClick={() => handleClick(name)}
        tabIndex={-1}
        className={`cursor-pointer text-[10px] outline-none ${isSelected ? "fill-foreground" : "fill-muted-foreground"}`}
      >
        {name}
      </text>
    );
  }

  function ValueLabel({ x = 0, y = 0, value, index = 0 }: LabelProps) {
    const name = chartData[index]?.label ?? "";
    const isSelected = !selected || selected === name;
    return (
      <text
        x={x}
        y={y - 6}
        textAnchor="middle"
        onClick={() => handleClick(name)}
        tabIndex={-1}
        className={`cursor-pointer text-[10px] font-medium outline-none ${isSelected ? "fill-foreground" : "fill-muted-foreground"}`}
      >
        {value}
      </text>
    );
  }

  return (
    <Card>
      <CardHeader className="flex items-center justify-between gap-2 pb-2">
        <CardTitle className="text-base font-semibold">{t("employees.chart.byDepartment")}</CardTitle>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            <T k="employees.kpi.total" />: <span className="font-semibold text-foreground">{total}</span>
          </span>
          <DepartmentDetailDialog data={hierarchy} defaultOrgUnitLevel1={defaultOrgUnitLevel1} />
        </div>
      </CardHeader>
      <CardContent>
        <HorizontalScroll>
          <div className="h-[260px]" style={{ minWidth: `${chartData.length * ITEM_WIDTH}px` }}>
            <ChartContainer config={{}} className="aspect-auto h-full w-full">
              <BarChart data={chartData} margin={{ top: 20, right: 8, left: 8, bottom: 44 }} barCategoryGap={16} accessibilityLayer={false}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} interval={0} height={50} tick={<DeptTick />} />
                <YAxis hide domain={[0, (max: number) => max * 1.15]} />
                <Bar dataKey="value" radius={3} barSize={18}>
                  {chartData.map((item) => (
                    <Cell
                      key={item.label}
                      fill={CHART_BRAND}
                      fillOpacity={!selected || selected === item.label ? 1 : 0.35}
                      className="cursor-pointer"
                      onClick={() => handleClick(item.label)}
                    />
                  ))}
                  <LabelList dataKey="value" content={<ValueLabel />} />
                </Bar>
              </BarChart>
            </ChartContainer>
          </div>
        </HorizontalScroll>
      </CardContent>
    </Card>
  );
}
