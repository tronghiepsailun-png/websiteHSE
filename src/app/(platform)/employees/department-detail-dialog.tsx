"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useT } from "@/lib/i18n/locale-context";
import type { Level1Breakdown } from "@/server/employees";

function name(value: string | null, unspecified: string) {
  return value ?? unspecified;
}

/** "Xem chi tiết" on the department distribution chart — lets the user pick one Bộ phận cấp 1
 *  and see its full Bộ phận cấp 2 → Khu vực → Tổ nhóm → Ca headcount breakdown, fully expanded
 *  by default (native <details> so any branch can still be collapsed). */
export function DepartmentDetailDialog({ data, defaultOrgUnitLevel1 }: { data: Level1Breakdown[]; defaultOrgUnitLevel1?: string }) {
  const t = useT();
  const unspecified = t("incidents.chart.unspecified");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(defaultOrgUnitLevel1 ?? data[0]?.orgUnitLevel1 ?? "");
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
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("employees.chart.viewDetailTitle")}</DialogTitle>
        </DialogHeader>

        <Select value={selected} onValueChange={(value) => value && setSelected(value)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t("employees.chart.selectDepartment")} />
          </SelectTrigger>
          <SelectContent>
            {data.map((d) => (
              <SelectItem key={d.orgUnitLevel1 ?? unspecified} value={d.orgUnitLevel1 ?? unspecified}>
                {name(d.orgUnitLevel1, unspecified)} ({d.count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {current && (
          <div className="max-h-[60vh] overflow-y-auto text-sm">
            <div className="flex items-center justify-between border-b border-border py-2 font-semibold">
              <span>{name(current.orgUnitLevel1, unspecified)}</span>
              <span className="text-muted-foreground">{t("employees.table.paginationSummary", { total: current.count })}</span>
            </div>

            {current.level2.map((l2) => (
              <details key={l2.orgUnitLevel2 ?? unspecified} open className="border-b border-border/50">
                <summary className="flex cursor-pointer items-center justify-between py-2 font-medium">
                  <span>{name(l2.orgUnitLevel2, unspecified)}</span>
                  <span className="text-muted-foreground">{t("employees.table.paginationSummary", { total: l2.count })}</span>
                </summary>
                <div className="pl-4 pb-1">
                  {l2.regions.map((r) => (
                    <details key={r.region ?? unspecified} open>
                      <summary className="flex cursor-pointer items-center justify-between py-1.5">
                        <span>{name(r.region, unspecified)}</span>
                        <span className="text-muted-foreground">{t("employees.table.paginationSummary", { total: r.count })}</span>
                      </summary>
                      <div className="pl-4 pb-1">
                        {r.teams.map((tm) => (
                          <details key={tm.team ?? unspecified} open>
                            <summary className="flex cursor-pointer items-center justify-between py-1 text-[13px]">
                              <span>{name(tm.team, unspecified)}</span>
                              <span className="text-muted-foreground">{t("employees.table.paginationSummary", { total: tm.count })}</span>
                            </summary>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 py-1 pl-4 text-xs text-muted-foreground">
                              {tm.shifts.map((s) => (
                                <span key={s.shift ?? unspecified}>
                                  {name(s.shift, unspecified)}: {s.count}
                                </span>
                              ))}
                            </div>
                          </details>
                        ))}
                      </div>
                    </details>
                  ))}
                </div>
              </details>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
