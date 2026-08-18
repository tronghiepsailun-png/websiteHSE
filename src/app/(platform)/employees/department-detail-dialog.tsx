"use client";

import { useState } from "react";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useT } from "@/lib/i18n/locale-context";
import { CHART_BRAND } from "@/components/charts/chart-utils";
import type { Level2Breakdown, Level1Breakdown } from "@/server/employees";

function name(value: string | null, unspecified: string) {
  return value ?? unspecified;
}

/** Thin proportion bar reused at every row — value/parent-total is visible as a bar length,
 *  not just a number, so a screenshot reads "big vs small" without doing mental math. */
function ProportionBar({ value, total }: { value: number; total: number }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <span className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-muted">
      <span className="block h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: CHART_BRAND }} />
    </span>
  );
}

/** Icon-box KPI tile — the same "icon-box + caption + big number" shape used for KPI cards
 *  everywhere else in the app, just reused here instead of a plain text block. */
function KpiTile({ label, value, selected, onClick }: { label: string; value: number; selected?: boolean; onClick?: () => void }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`flex items-center gap-2.5 rounded-lg border p-2.5 text-left transition-colors ${
        selected ? "border-transparent bg-[var(--chart-brand)]/12 ring-1 ring-[var(--chart-brand)]" : "border-border hover:bg-muted/50"
      }`}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-[var(--chart-brand)]/10 text-[var(--chart-brand)]">
        <Building2 className="size-4" />
      </span>
      <span className="min-w-0">
        <p className="truncate text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{label}</p>
        <p className="text-lg leading-none font-bold">{value}</p>
      </span>
    </Tag>
  );
}

/** One Bộ phận cấp 2's full Khu vực → Tổ nhóm → Ca breakdown as a proper table — Khu vực
 *  rowspans over its Tổ nhóm rows, matching how the numbers are actually structured. */
function Level2Table({ l2, unspecified, unitLabel, t }: { l2: Level2Breakdown; unspecified: string; unitLabel: string; t: ReturnType<typeof useT> }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="flex items-center gap-2.5 border-b border-border bg-muted/30 px-3 py-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-[var(--chart-brand)]/10 text-[var(--chart-brand)]">
          <Building2 className="size-3.5" />
        </span>
        <span className="text-sm font-semibold">{name(l2.orgUnitLevel2, unspecified)}</span>
        <span className="ml-auto text-xs text-muted-foreground">{t("employees.table.paginationSummary", { total: l2.count })}</span>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-28">{t("employees.filter.region")}</TableHead>
            <TableHead>{t("employees.filter.team")}</TableHead>
            <TableHead className="text-right">{unitLabel}</TableHead>
            <TableHead className="w-24">{t("employees.chart.ratio")}</TableHead>
            <TableHead>{t("employees.chart.shiftDetail")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {l2.regions.flatMap((r) =>
            r.teams.map((tm, i) => (
              <TableRow key={`${r.region ?? unspecified}-${tm.team ?? unspecified}`}>
                {i === 0 && (
                  <TableCell rowSpan={r.teams.length} className="align-top font-medium">
                    {name(r.region, unspecified)}
                    <div className="text-xs font-normal text-muted-foreground">{t("employees.table.paginationSummary", { total: r.count })}</div>
                  </TableCell>
                )}
                <TableCell>{name(tm.team, unspecified)}</TableCell>
                <TableCell className="text-right font-mono">{tm.count}</TableCell>
                <TableCell>
                  <ProportionBar value={tm.count} total={r.count} />
                </TableCell>
                <TableCell className="whitespace-normal text-xs text-muted-foreground">
                  {tm.shifts.map((s) => `${name(s.shift, unspecified)} ${s.count}`).join(" · ")}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

/** "Xem chi tiết" on the department distribution chart — opens a large, screenshot-ready
 *  overview: every Bộ phận cấp 1 as a KPI strip (click to switch), then the selected one's
 *  Bộ phận cấp 2 tiles, then each cấp 2's full Khu vực → Tổ nhóm → Ca table — so the whole
 *  picture ("giống mở module mới") is readable at a glance, no extra clicks needed. */
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="ghost" size="sm" />}>{t("employees.chart.viewDetail")}</DialogTrigger>
      <DialogContent className="flex h-[88vh] flex-col sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>{t("employees.chart.viewDetailTitle")}</DialogTitle>
        </DialogHeader>

        {/* Overview strip — every Bộ phận cấp 1 at once, so the full picture is visible before
         *  drilling into any one of them (a screenshot of just this row already tells the
         *  story: who's biggest, who's smallest). */}
        <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {data.map((d) => {
            const key = d.orgUnitLevel1 ?? unspecified;
            return <KpiTile key={key} label={name(d.orgUnitLevel1, unspecified)} value={d.count} selected={key === selected} onClick={() => setSelected(key)} />;
          })}
        </div>

        {/* Selected department — total KPI, cấp-2 tiles, then each cấp-2's full table. */}
        {current && (
          <div className="flex-1 overflow-y-auto pt-1">
            <div className="mb-3 flex items-baseline justify-between border-b border-border pb-2">
              <h3 className="text-base font-semibold">{name(current.orgUnitLevel1, unspecified)}</h3>
              <span className="text-2xl leading-none font-bold">
                {current.count}
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">{unitLabel}</span>
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  ({grandTotal > 0 ? Math.round((current.count / grandTotal) * 100) : 0}% {t("employees.chart.ofTotal")})
                </span>
              </span>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {current.level2.map((l2) => (
                <KpiTile key={l2.orgUnitLevel2 ?? unspecified} label={name(l2.orgUnitLevel2, unspecified)} value={l2.count} />
              ))}
            </div>

            <div className="flex flex-col gap-3">
              {current.level2.map((l2) => (
                <Level2Table key={l2.orgUnitLevel2 ?? unspecified} l2={l2} unspecified={unspecified} unitLabel={unitLabel} t={t} />
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
