"use client";

import { useState } from "react";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useT } from "@/lib/i18n/locale-context";
import { CHART_BRAND } from "@/components/charts/chart-utils";
import type { Level2Breakdown, Level1Breakdown } from "@/server/employees";

function name(value: string | null, unspecified: string) {
  return value ?? unspecified;
}

/** Thin proportion bar — value/parent-total is visible as a bar length, not a number, per the
 *  "don't turn everything into a percentage" brief; the bar alone communicates the ratio. */
function ProportionBar({ value, total }: { value: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <span className="block h-1.5 w-full max-w-28 overflow-hidden rounded-full bg-muted">
      <span className="block h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: CHART_BRAND }} />
    </span>
  );
}

/** Icon-box KPI tile shared by both tiers (Bộ phận cấp 1 in blue, cấp 2 in purple) — same
 *  shape, same height, only the accent color and click-ability differ. */
function KpiTile({
  label,
  value,
  accent,
  selected,
  onClick,
}: {
  label: string;
  value: number;
  accent: string;
  selected?: boolean;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`flex h-[76px] items-center gap-3 rounded-xl border p-3.5 text-left transition-colors ${
        selected ? "border-transparent" : "border-border bg-muted/30 hover:bg-muted/60"
      }`}
      style={{
        backgroundColor: selected ? `color-mix(in srgb, ${accent} 12%, transparent)` : undefined,
        boxShadow: selected ? `inset 0 0 0 1px color-mix(in srgb, ${accent} 40%, transparent)` : undefined,
      }}
    >
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: `color-mix(in srgb, ${accent} 15%, transparent)`, color: accent }}
      >
        <Building2 className="size-[18px]" />
      </span>
      <span className="min-w-0">
        <p className="truncate text-[11px] font-medium text-muted-foreground">{label}</p>
        <p className="text-xl leading-tight font-bold text-foreground">{value.toLocaleString("vi-VN")}</p>
      </span>
    </Tag>
  );
}

/** One Bộ phận cấp 2's full Khu vực → Tổ nhóm → Ca breakdown as its own small section + table
 *  — kept separate per cấp 2 rather than one giant table, per "split into smaller tables". */
function Level2Section({ l2, unspecified, unitLabel, t }: { l2: Level2Breakdown; unspecified: string; unitLabel: string; t: ReturnType<typeof useT> }) {
  const regionCount = l2.regions.length;
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-muted/20">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: CHART_BRAND }} />
        <span className="text-sm font-semibold text-foreground">{name(l2.orgUnitLevel2, unspecified)}</span>
        <span className="ml-auto text-xs text-muted-foreground">
          {l2.count.toLocaleString("vi-VN")} {unitLabel} · {regionCount} {t("employees.filter.region").toLowerCase()}
        </span>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead className="w-28 pl-4 text-[11px] tracking-wide text-muted-foreground uppercase">{t("employees.filter.region")}</TableHead>
            <TableHead className="text-[11px] tracking-wide text-muted-foreground uppercase">{t("employees.filter.team")}</TableHead>
            <TableHead className="text-right text-[11px] tracking-wide text-muted-foreground uppercase">{unitLabel}</TableHead>
            <TableHead className="w-28 text-[11px] tracking-wide text-muted-foreground uppercase">{t("employees.chart.ratio")}</TableHead>
            <TableHead className="pr-4 text-[11px] tracking-wide text-muted-foreground uppercase">{t("employees.chart.shiftDetail")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {l2.regions.flatMap((r) =>
            r.teams.map((tm, i) => (
              <TableRow key={`${r.region ?? unspecified}-${tm.team ?? unspecified}`} className="border-border">
                {i === 0 && (
                  <TableCell rowSpan={r.teams.length} className="w-28 border-r border-border pl-4 align-top font-medium text-foreground">
                    {name(r.region, unspecified)}
                    <div className="text-xs font-normal text-muted-foreground">
                      {r.count.toLocaleString("vi-VN")} {unitLabel}
                    </div>
                  </TableCell>
                )}
                <TableCell className="text-foreground/90">{name(tm.team, unspecified)}</TableCell>
                <TableCell className="text-right font-mono text-foreground">{tm.count}</TableCell>
                <TableCell>
                  <ProportionBar value={tm.count} total={r.count} />
                </TableCell>
                <TableCell className="whitespace-normal pr-4 text-xs text-muted-foreground">
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

/** "Xem chi tiết" on the department distribution chart — an enterprise-dashboard-style
 *  drill-down: header with org-wide total, a Bộ phận cấp 1 KPI strip (click to switch), the
 *  selected one's Bộ phận cấp 2 tiles, then each cấp 2's own Khu vực → Tổ nhóm → Ca table.
 *  Every number is real (getEmployeeHierarchy) — only the visual language is new. */
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
      <DialogContent className="flex h-[88vh] max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl">
        {/* Header — icon + title + subtitle on the left, org-wide total as status meta on the right. */}
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-6 py-5">
          <div className="flex items-start gap-3">
            <span
              className="flex size-10 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: "color-mix(in srgb, var(--accent-blue) 15%, transparent)", color: "var(--accent-blue)" }}
            >
              <Building2 className="size-5" />
            </span>
            <div>
              <DialogTitle className="text-lg font-bold text-foreground">{t("employees.chart.viewDetailTitle")}</DialogTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">{t("employees.chart.viewDetailSubtitle")}</p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[11px] font-medium text-muted-foreground">{t("employees.kpi.total")}</p>
            <p className="text-lg font-bold text-foreground">{grandTotal.toLocaleString("vi-VN")}</p>
          </div>
        </div>

        <div className="thin-scrollbar flex-1 overflow-y-auto px-6 py-5">
          {/* Section 1 — every Bộ phận cấp 1 at once, blue tier. */}
          <div className="mb-6">
            <p className="mb-2.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{t("employees.chart.byLevel1")}</p>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
              {data.map((d) => {
                const key = d.orgUnitLevel1 ?? unspecified;
                return (
                  <KpiTile
                    key={key}
                    label={name(d.orgUnitLevel1, unspecified)}
                    value={d.count}
                    accent="var(--accent-blue)"
                    selected={key === selected}
                    onClick={() => setSelected(key)}
                  />
                );
              })}
            </div>
          </div>

          {/* Section 2 — selected department: name + meta, then its cấp-2 tiles, purple tier. */}
          {current && (
            <>
              <div className="mb-2.5 flex items-baseline justify-between">
                <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
                  <span className="size-1.5 rounded-full" style={{ backgroundColor: "var(--accent-blue)" }} />
                  {name(current.orgUnitLevel1, unspecified)}
                </h3>
                <span className="text-xs text-muted-foreground">
                  {current.count.toLocaleString("vi-VN")} {unitLabel} · {current.level2.length} {t("employees.chart.subgroups")}
                </span>
              </div>

              <div className="mb-6 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
                {current.level2.map((l2) => (
                  <KpiTile key={l2.orgUnitLevel2 ?? unspecified} label={name(l2.orgUnitLevel2, unspecified)} value={l2.count} accent="var(--accent-purple)" />
                ))}
              </div>

              {/* Section 3 — detail tables, one per cấp-2, each its own contained panel. */}
              <p className="mb-2.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{t("employees.chart.detailByLevel2")}</p>
              <div className="flex flex-col gap-4">
                {current.level2.map((l2) => (
                  <Level2Section key={l2.orgUnitLevel2 ?? unspecified} l2={l2} unspecified={unspecified} unitLabel={unitLabel} t={t} />
                ))}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
