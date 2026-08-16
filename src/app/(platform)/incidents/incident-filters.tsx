"use client";

import { useRef } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FilterCountBadge } from "@/components/ui/filter-count-badge";
import { countActiveFilters } from "@/lib/count-active-filters";
import { useT } from "@/lib/i18n/locale-context";
import type { DictionaryKey } from "@/lib/i18n/translate";

type Option = { id: string; name: string };

export function IncidentFilters({
  search,
  status,
  categoryId,
  severityId,
  categories,
  severities,
  carry,
}: {
  search?: string;
  status?: string;
  categoryId?: string;
  severityId?: string;
  categories: Option[];
  severities: Option[];
  carry: { year?: number; month?: number; week?: number; orgUnitId?: string };
}) {
  const t = useT();
  const activeCount = countActiveFilters(search, status, categoryId, severityId);
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

  return (
    <Card>
      <CardContent className="p-3">
        <form ref={formRef} className="flex flex-wrap items-center gap-2">
          {carry.year && <input type="hidden" name="dYear" value={carry.year} />}
          {carry.month && <input type="hidden" name="dMonth" value={carry.month} />}
          {carry.week && <input type="hidden" name="dWeek" value={carry.week} />}
          {carry.orgUnitId && <input type="hidden" name="dOrgUnitId" value={carry.orgUnitId} />}

          <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-[2fr_1fr_1fr_1fr]">
            <Input
              name="q"
              placeholder={t("incidents.filter.searchPlaceholder")}
              defaultValue={search}
              onKeyDown={submitOnEnter}
              className="col-span-2 sm:col-span-1"
            />
            <Select key={`status-${status ?? "all"}`} name="status" defaultValue={status ?? "all"} onValueChange={submitOnChange}>
              <SelectTrigger>
                <SelectValue placeholder={t("incidents.filter.statusPlaceholder")}>
                  {(value: string) => (value === "all" ? t("incidents.filter.allStatuses") : t(`status.incident.${value}` as DictionaryKey))}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("incidents.filter.allStatuses")}</SelectItem>
                <SelectItem value="open">{t("status.incident.open")}</SelectItem>
                <SelectItem value="investigating">{t("status.incident.investigating")}</SelectItem>
                <SelectItem value="action_pending">{t("status.incident.action_pending")}</SelectItem>
                <SelectItem value="closed">{t("status.incident.closed")}</SelectItem>
              </SelectContent>
            </Select>
            <Select key={`category-${categoryId ?? "all"}`} name="categoryId" defaultValue={categoryId ?? "all"} onValueChange={submitOnChange}>
              <SelectTrigger>
                <SelectValue placeholder={t("incidents.filter.categoryPlaceholder")}>
                  {(value: string) => (value === "all" ? t("incidents.filter.allCategories") : (categories.find((c) => c.id === value)?.name ?? value))}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("incidents.filter.allCategories")}</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select key={`severity-${severityId ?? "all"}`} name="severityId" defaultValue={severityId ?? "all"} onValueChange={submitOnChange}>
              <SelectTrigger>
                <SelectValue placeholder={t("incidents.filter.severityPlaceholder")}>
                  {(value: string) => (value === "all" ? t("incidents.filter.allSeverities") : (severities.find((s) => s.id === value)?.name ?? value))}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("incidents.filter.allSeverities")}</SelectItem>
                {severities.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <FilterCountBadge count={activeCount} />
            <Link href="/incidents" className={buttonVariants({ variant: "outline", size: "sm" })}>
              {t("common.clearFilters")}
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
