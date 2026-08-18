"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useT } from "@/lib/i18n/locale-context";
import { CHART_BRAND } from "@/components/charts/chart-utils";
import type { Level1Breakdown, RegionBreakdown } from "@/server/employees";

function name(value: string | null, unspecified: string) {
  return value ?? unspecified;
}

/** Thin proportion bar reused at every nested level — value/parent-total is visible as a bar
 *  length, not just a number, so a screenshot reads "big vs small" without doing mental math. */
function ProportionBar({ value, total }: { value: number; total: number }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <span className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-muted">
      <span className="block h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: CHART_BRAND }} />
    </span>
  );
}

/** "Xem chi tiết" on the department distribution chart — opens a large, screenshot-ready
 *  breakdown: every Bộ phận cấp 1 as a KPI overview strip (click to switch), then the selected
 *  one's full Bộ phận cấp 2 → Khu vực → Tổ nhóm → Ca headcount tree, fully expanded so the
 *  whole picture ("giống mở module mới") is readable at a glance without extra clicks. */
export function DepartmentDetailDialog({ data, defaultOrgUnitLevel1 }: { data: Level1Breakdown[]; defaultOrgUnitLevel1?: string }) {
  const t = useT();
  const unspecified = t("incidents.chart.unspecified");
  const unitLabel = t("employees.unitLabel");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(defaultOrgUnitLevel1 ?? data[0]?.orgUnitLevel1 ?? "");
  const grandTotal = data.reduce((sum, d) => sum + d.count, 0);
  const current = data.find((d) => (d.orgUnitLevel1 ?? unspecified) === selected) ?? data[0];

  // Re-sync to the chart's current selection each time the dialog is (re)opened, so clicking
  // a different bar then reopening "Xem chi tiết" reflects that bar instead of a stale choice.
  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) setSelected(defaultOrgUnitLevel1 ?? data[0]?.orgUnitLevel1 ?? "");
  }

  if (data.length === 0) return null;

  function regionRow(r: RegionBreakdown, parentTotal: number) {
    return (
      <details key={r.region ?? unspecified} open className="rounded-md border border-border/50 bg-muted/20 p-2">
        <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium">
          <span className="flex-1">{name(r.region, unspecified)}</span>
          <ProportionBar value={r.count} total={parentTotal} />
          <span className="w-14 shrink-0 text-right text-muted-foreground">{t("employees.table.paginationSummary", { total: r.count })}</span>
        </summary>
        <div className="mt-1.5 flex flex-col gap-1 pl-4">
          {r.teams.map((tm) => (
            <div key={tm.team ?? unspecified} className="flex items-center gap-2 text-[13px]">
              <span className="flex-1 truncate">{name(tm.team, unspecified)}</span>
              <ProportionBar value={tm.count} total={r.count} />
              <span className="w-14 shrink-0 text-right text-muted-foreground">{tm.count}</span>
              <span className="w-[26%] shrink-0 truncate text-right text-xs text-muted-foreground">
                {tm.shifts.map((s) => `${name(s.shift, unspecified)} ${s.count}`).join(" · ")}
              </span>
            </div>
          ))}
        </div>
      </details>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="ghost" size="sm" />}>{t("employees.chart.viewDetail")}</DialogTrigger>
      <DialogContent className="flex h-[88vh] flex-col sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>{t("employees.chart.viewDetailTitle")}</DialogTitle>
        </DialogHeader>

        {/* Overview strip — every Bộ phận cấp 1 at once, so the full picture is visible before
         *  drilling into any one of them (and a screenshot of just this row already tells the
         *  story: who's biggest, who's smallest). */}
        <div className="grid shrink-0 grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {data.map((d) => {
            const key = d.orgUnitLevel1 ?? unspecified;
            const isSelected = key === selected;
            const pct = grandTotal > 0 ? Math.round((d.count / grandTotal) * 100) : 0;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(key)}
                className={`rounded-lg border p-2.5 text-left transition-colors ${
                  isSelected ? "border-transparent bg-[var(--chart-brand)]/12 ring-1 ring-[var(--chart-brand)]" : "border-border hover:bg-muted/50"
                }`}
              >
                <p className="truncate text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{name(d.orgUnitLevel1, unspecified)}</p>
                <p className="text-xl leading-none font-bold">{d.count}</p>
                <p className="text-[11px] text-muted-foreground">{pct}%</p>
              </button>
            );
          })}
        </div>

        {/* Selected department — total KPI, cấp-2 tiles, then the full nested breakdown. */}
        {current && (
          <div className="flex-1 overflow-y-auto pt-1">
            <div className="mb-3 flex items-baseline justify-between border-b border-border pb-2">
              <h3 className="text-base font-semibold">{name(current.orgUnitLevel1, unspecified)}</h3>
              <span className="text-2xl leading-none font-bold">
                {current.count}
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">{unitLabel}</span>
              </span>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {current.level2.map((l2) => (
                <div key={l2.orgUnitLevel2 ?? unspecified} className="rounded-lg border border-border p-2.5">
                  <p className="truncate text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{name(l2.orgUnitLevel2, unspecified)}</p>
                  <p className="text-lg leading-none font-bold">{l2.count}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3">
              {current.level2.map((l2) => (
                <details key={l2.orgUnitLevel2 ?? unspecified} open>
                  <summary className="flex cursor-pointer items-center justify-between border-b border-border/50 py-1.5 text-sm font-semibold">
                    <span>{name(l2.orgUnitLevel2, unspecified)}</span>
                    <span className="text-muted-foreground">{t("employees.table.paginationSummary", { total: l2.count })}</span>
                  </summary>
                  <div className="flex flex-col gap-1.5 pt-2 pl-2">{l2.regions.map((r) => regionRow(r, l2.count))}</div>
                </details>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
