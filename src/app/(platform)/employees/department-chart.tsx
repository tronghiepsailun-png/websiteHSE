"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useT } from "@/lib/i18n/locale-context";

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

  const maxValue = Math.max(1, ...data.map((d) => d.count));

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

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">{t("employees.chart.byDepartment")}</CardTitle>
      </CardHeader>
      <CardContent className="max-h-72 overflow-y-auto pt-0">
        <div className="flex flex-col">
          {data.map((dept) => {
            const isSelected = selected === dept.name;
            const percent = total > 0 ? (dept.count / total) * 100 : 0;
            return (
              <button
                key={dept.name}
                type="button"
                title={dept.name}
                onClick={() => handleClick(dept.name)}
                className={`flex h-7 shrink-0 items-center gap-2 rounded-md px-1.5 text-left transition-colors hover:bg-muted/60 ${
                  isSelected ? "bg-primary/10" : ""
                }`}
              >
                <span className={`w-32 shrink-0 truncate text-xs sm:w-44 ${isSelected ? "font-semibold text-primary" : "text-foreground"}`}>
                  {dept.name}
                </span>
                <span className="h-1.5 min-w-8 flex-1 overflow-hidden rounded-full bg-muted">
                  <span
                    className={`block h-full rounded-full ${isSelected ? "bg-primary" : "bg-foreground/30"}`}
                    style={{ width: `${(dept.count / maxValue) * 100}%` }}
                  />
                </span>
                <span className="w-9 shrink-0 text-right text-xs font-medium tabular-nums">{dept.count}</span>
                <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">{percent.toFixed(1)}%</span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
