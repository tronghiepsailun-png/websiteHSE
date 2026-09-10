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

export function RecordsFilters({
  search,
  orgUnitId,
  groupCode,
  dataStatus,
  expiryStatus,
  zones,
  groups,
}: {
  search?: string;
  orgUnitId?: string;
  groupCode?: string;
  dataStatus?: string;
  expiryStatus?: string;
  zones: Option[];
  groups: Option[];
}) {
  const t = useT();
  const activeCount = countActiveFilters(search, orgUnitId, groupCode, dataStatus, expiryStatus);
  const formRef = useRef<HTMLFormElement>(null);
  // Selects apply immediately on change — no need to hit a "Lọc" button (matches the
  // standard already applied to every other filter bar in the platform). With no submit
  // button left in the form, Enter is wired explicitly for the search box.
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
          <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-5">
            <Input
              name="q"
              placeholder={t("records.filter.searchPlaceholder")}
              defaultValue={search}
              onKeyDown={submitOnEnter}
              className="col-span-2 sm:col-span-1"
            />
            <Select key={`zone-${orgUnitId ?? "all"}`} name="orgUnitId" defaultValue={orgUnitId ?? "all"} onValueChange={submitOnChange}>
              <SelectTrigger>
                <SelectValue placeholder={t("records.filter.zone")}>
                  {(v: string) => (v === "all" ? t("records.filter.allZones") : (zones.find((z) => z.id === v)?.name ?? v))}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("records.filter.allZones")}</SelectItem>
                {zones.map((z) => (
                  <SelectItem key={z.id} value={z.id}>
                    {z.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select key={`group-${groupCode ?? "all"}`} name="groupCode" defaultValue={groupCode ?? "all"} onValueChange={submitOnChange}>
              <SelectTrigger>
                <SelectValue placeholder={t("records.filter.group")}>
                  {(v: string) => (v === "all" ? t("records.filter.allGroups") : (groups.find((g) => g.id === v)?.name ?? v))}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("records.filter.allGroups")}</SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select key={`ds-${dataStatus ?? "all"}`} name="dataStatus" defaultValue={dataStatus ?? "all"} onValueChange={submitOnChange}>
              <SelectTrigger>
                <SelectValue placeholder={t("records.filter.dataStatus")}>
                  {(v: string) => (v === "all" ? t("records.filter.allDataStatuses") : t(`records.dataStatus.${v}` as DictionaryKey))}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("records.filter.allDataStatuses")}</SelectItem>
                <SelectItem value="sufficient">{t("records.dataStatus.sufficient")}</SelectItem>
                <SelectItem value="needs_update">{t("records.dataStatus.needs_update")}</SelectItem>
                <SelectItem value="not_applicable">{t("records.dataStatus.not_applicable")}</SelectItem>
              </SelectContent>
            </Select>
            <Select key={`es-${expiryStatus ?? "all"}`} name="expiryStatus" defaultValue={expiryStatus ?? "all"} onValueChange={submitOnChange}>
              <SelectTrigger>
                <SelectValue placeholder={t("records.filter.expiryStatus")}>
                  {(v: string) => (v === "all" ? t("records.filter.allExpiryStatuses") : t(`records.expiryStatus.${v}` as DictionaryKey))}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("records.filter.allExpiryStatuses")}</SelectItem>
                <SelectItem value="valid">{t("records.expiryStatus.valid")}</SelectItem>
                <SelectItem value="expiring_soon">{t("records.expiryStatus.expiring_soon")}</SelectItem>
                <SelectItem value="expired">{t("records.expiryStatus.expired")}</SelectItem>
                <SelectItem value="non_periodic">{t("records.expiryStatus.non_periodic")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <FilterCountBadge count={activeCount} />
            <Link href="/records/pccc/list" className={buttonVariants({ variant: "outline", size: "sm" })}>
              {t("common.clearFilters")}
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
