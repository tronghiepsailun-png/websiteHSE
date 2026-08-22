"use client";

import { useRef } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useT } from "@/lib/i18n/locale-context";

type OrgUnitOption = { id: string; name: string };

export function DashboardFilters({
  year,
  month,
  week,
  orgUnitId,
  availableYears,
  orgUnits,
  carry,
}: {
  year?: number;
  month?: number;
  week?: number;
  orgUnitId?: string;
  availableYears: number[];
  orgUnits: OrgUnitOption[];
  carry: { q?: string; status?: string; categoryId?: string; severityId?: string };
}) {
  const t = useT();
  const formRef = useRef<HTMLFormElement>(null);
  // Selects apply immediately on change — no need to hit "Lọc" separately. Deferred so the
  // Select's own hidden input has committed the new value before the form serializes it.
  const submitOnChange = () => setTimeout(() => formRef.current?.requestSubmit(), 0);

  const yearValue = year ? String(year) : "all";
  const monthValue = month ? String(month) : "all";
  const weekValue = week ? String(week) : "all";
  const orgUnitValue = orgUnitId ?? "all";

  return (
    <form ref={formRef} className="flex flex-wrap items-center gap-2">
      {carry.q && <input type="hidden" name="q" value={carry.q} />}
      {carry.status && <input type="hidden" name="status" value={carry.status} />}
      {carry.categoryId && <input type="hidden" name="categoryId" value={carry.categoryId} />}
      {carry.severityId && <input type="hidden" name="severityId" value={carry.severityId} />}

      <div className="flex flex-1 flex-wrap items-center gap-2">
        <Select key={`dYear-${yearValue}`} name="dYear" defaultValue={yearValue} onValueChange={submitOnChange}>
          <SelectTrigger>
            <SelectValue placeholder={t("incidents.dashboard.year")}>
              {(value: string) => (value === "all" ? t("incidents.dashboard.allYears") : value)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("incidents.dashboard.allYears")}</SelectItem>
            {availableYears.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select key={`dMonth-${monthValue}`} name="dMonth" defaultValue={monthValue} onValueChange={submitOnChange}>
          <SelectTrigger>
            <SelectValue placeholder={t("incidents.dashboard.month")}>
              {(value: string) => (value === "all" ? t("incidents.dashboard.allMonths") : t("incidents.dashboard.monthLabel", { n: value }))}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("incidents.dashboard.allMonths")}</SelectItem>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <SelectItem key={m} value={String(m)}>
                {t("incidents.dashboard.monthLabel", { n: m })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select key={`dWeek-${weekValue}`} name="dWeek" defaultValue={weekValue} onValueChange={submitOnChange}>
          <SelectTrigger>
            <SelectValue placeholder={t("incidents.dashboard.week")}>
              {(value: string) => (value === "all" ? t("incidents.dashboard.allWeeks") : t("incidents.dashboard.weekLabel", { n: value }))}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("incidents.dashboard.allWeeks")}</SelectItem>
            {Array.from({ length: 53 }, (_, i) => i + 1).map((w) => (
              <SelectItem key={w} value={String(w)}>
                {t("incidents.dashboard.weekLabel", { n: w })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select key={`dOrgUnit-${orgUnitValue}`} name="dOrgUnitId" defaultValue={orgUnitValue} onValueChange={submitOnChange}>
          <SelectTrigger>
            <SelectValue placeholder={t("incidents.dashboard.department")}>
              {(value: string) => (value === "all" ? t("incidents.dashboard.allDepartments") : (orgUnits.find((u) => u.id === value)?.name ?? value))}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("incidents.dashboard.allDepartments")}</SelectItem>
            {orgUnits.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Link href="/incidents" className={buttonVariants({ variant: "outline", size: "sm" })}>
        {t("common.clearFilters")}
      </Link>
    </form>
  );
}
