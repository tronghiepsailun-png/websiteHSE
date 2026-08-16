"use client";

import { useRef } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useT } from "@/lib/i18n/locale-context";

export function EmployeeFilters({
  search,
  orgUnitLevel1,
  orgUnitLevel2,
  region,
  shift,
  position,
  status,
  options,
}: {
  search?: string;
  orgUnitLevel1?: string;
  orgUnitLevel2?: string;
  region?: string;
  shift?: string;
  position?: string;
  status?: string;
  options: { orgUnitLevel1: string[]; orgUnitLevel2: string[]; region: string[]; shift: string[]; position: string[] };
}) {
  const t = useT();
  const formRef = useRef<HTMLFormElement>(null);
  // Selects apply immediately on change — no need to hit "Lọc" separately (the search box
  // still needs Enter, since submitting on every keystroke would be unusable). With no submit
  // button left in the form, the browser's implicit-submit-on-Enter no longer reliably fires
  // (multiple other form-associated fields), so Enter is wired explicitly.
  const submitOnChange = () => setTimeout(() => formRef.current?.requestSubmit(), 0);
  const submitOnEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  };

  const selectField = (name: string, value: string | undefined, items: string[], placeholderKey: Parameters<typeof t>[0], allKey: Parameters<typeof t>[0]) => (
    <Select key={`${name}-${value ?? "all"}`} name={name} defaultValue={value ?? "all"} onValueChange={submitOnChange}>
      <SelectTrigger>
        <SelectValue placeholder={t(placeholderKey)}>{(v: string) => (v === "all" ? t(allKey) : v)}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{t(allKey)}</SelectItem>
        {items.map((item) => (
          <SelectItem key={item} value={item}>
            {item}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <Card>
      <CardContent className="p-3">
        <form ref={formRef} className="flex flex-wrap items-center gap-2">
          <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            <Input
              name="q"
              placeholder={t("employees.filter.searchPlaceholder")}
              defaultValue={search}
              onKeyDown={submitOnEnter}
              className="col-span-2 sm:col-span-2 lg:col-span-2"
            />
            {selectField("orgUnitLevel1", orgUnitLevel1, options.orgUnitLevel1, "employees.filter.orgUnitLevel1", "employees.filter.allOrgUnitLevel1")}
            {selectField("orgUnitLevel2", orgUnitLevel2, options.orgUnitLevel2, "employees.filter.orgUnitLevel2", "employees.filter.allOrgUnitLevel2")}
            {selectField("region", region, options.region, "employees.filter.region", "employees.filter.allRegion")}
            {selectField("shift", shift, options.shift, "employees.filter.shift", "employees.filter.allShift")}
            {selectField("position", position, options.position, "employees.filter.position", "employees.filter.allPosition")}
            <Select key={`status-${status ?? "all"}`} name="status" defaultValue={status ?? "all"} onValueChange={submitOnChange}>
              <SelectTrigger>
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

          <Link href="/employees" className={buttonVariants({ variant: "outline", size: "sm" })}>
            {t("common.clearFilters")}
          </Link>
        </form>
      </CardContent>
    </Card>
  );
}
