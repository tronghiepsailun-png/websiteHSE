"use client";

import { useRef } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FilterCountBadge } from "@/components/ui/filter-count-badge";
import { countActiveFilters } from "@/lib/count-active-filters";
import { useT } from "@/lib/i18n/locale-context";
import type { FacetOption } from "@/server/employees";
import { EmployeeSearchBox } from "./employee-search-box";

export function EmployeeFilters({
  search,
  orgUnitLevel1,
  orgUnitLevel2,
  region,
  team,
  shift,
  position,
  status,
  options,
}: {
  search?: string;
  orgUnitLevel1?: string;
  orgUnitLevel2?: string;
  region?: string;
  team?: string;
  shift?: string;
  position?: string;
  status?: string;
  options: { orgUnitLevel1: FacetOption[]; orgUnitLevel2: FacetOption[]; region: FacetOption[]; team: FacetOption[]; shift: FacetOption[]; position: FacetOption[] };
}) {
  const t = useT();
  const activeCount = countActiveFilters(search, orgUnitLevel1, orgUnitLevel2, region, team, shift, position, status);
  const formRef = useRef<HTMLFormElement>(null);
  // Selects apply immediately on change — no need to hit "Lọc" separately (the search box
  // still needs Enter, since submitting on every keystroke would be unusable). With no submit
  // button left in the form, the browser's implicit-submit-on-Enter no longer reliably fires
  // (multiple other form-associated fields), so Enter is wired explicitly.
  const submitOnChange = () => setTimeout(() => formRef.current?.requestSubmit(), 0);

  const selectField = (name: string, value: string | undefined, items: FacetOption[], placeholderKey: Parameters<typeof t>[0], allKey: Parameters<typeof t>[0]) => (
    <Select key={`${name}-${value ?? "all"}`} name={name} defaultValue={value ?? "all"} onValueChange={submitOnChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={t(placeholderKey)}>{(v: string) => (v === "all" ? t(allKey) : v)}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{t(allKey)}</SelectItem>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.value} ({item.count})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <Card>
      <CardContent className="p-3">
        <form ref={formRef} className="flex flex-wrap items-center gap-2">
          <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
            <EmployeeSearchBox
              name="q"
              placeholder={t("employees.filter.searchPlaceholder")}
              defaultValue={search}
              emptyLabel={t("incidents.new.noEmployeeMatch")}
              onSubmit={submitOnChange}
              className="col-span-2 w-full sm:col-span-1"
            />
            {selectField("orgUnitLevel1", orgUnitLevel1, options.orgUnitLevel1, "employees.filter.orgUnitLevel1", "employees.filter.allOrgUnitLevel1")}
            {selectField("orgUnitLevel2", orgUnitLevel2, options.orgUnitLevel2, "employees.filter.orgUnitLevel2", "employees.filter.allOrgUnitLevel2")}
            {selectField("region", region, options.region, "employees.filter.region", "employees.filter.allRegion")}
            {selectField("team", team, options.team, "employees.filter.team", "employees.filter.allTeam")}
            {selectField("shift", shift, options.shift, "employees.filter.shift", "employees.filter.allShift")}
            {selectField("position", position, options.position, "employees.filter.position", "employees.filter.allPosition")}
            <Select key={`status-${status ?? "all"}`} name="status" defaultValue={status ?? "all"} onValueChange={submitOnChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("employees.filter.status")}>
                  {(v: string) => (v === "all" ? t("employees.filter.allStatus") : t(`employees.status.${v}` as Parameters<typeof t>[0]))}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("employees.filter.allStatus")}</SelectItem>
                <SelectItem value="active">{t("employees.status.active")}</SelectItem>
                <SelectItem value="resigned">{t("employees.status.resigned")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <FilterCountBadge count={activeCount} />
            <Link href="/employees" className={buttonVariants({ variant: "outline", size: "sm" })}>
              {t("common.clearFilters")}
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
