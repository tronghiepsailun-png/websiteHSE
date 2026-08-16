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

export function CapaFilters({ search, status }: { search?: string; status?: string }) {
  const t = useT();
  const activeCount = countActiveFilters(search, status);
  const formRef = useRef<HTMLFormElement>(null);
  // The status Select applies immediately on change — no need to hit "Lọc" separately (the
  // search box still needs Enter, since submitting on every keystroke would be unusable). With
  // no submit button left in the form, the browser's implicit-submit-on-Enter no longer
  // reliably fires (multiple other form-associated fields), so Enter is wired explicitly.
  const submitOnChange = () => setTimeout(() => formRef.current?.requestSubmit(), 0);
  const submitOnEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <form ref={formRef} className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr_auto]">
          <Input name="q" placeholder={t("capa.filter.searchPlaceholder")} defaultValue={search} onKeyDown={submitOnEnter} />
          <Select key={status ?? "all"} name="status" defaultValue={status ?? "all"} onValueChange={submitOnChange}>
            <SelectTrigger>
              <SelectValue placeholder={t("common.status")}>
                {(value: string) => (value === "all" ? t("capa.filter.allStatuses") : t(`status.capa.${value}` as DictionaryKey))}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("capa.filter.allStatuses")}</SelectItem>
              <SelectItem value="open">{t("status.capa.open")}</SelectItem>
              <SelectItem value="in_progress">{t("status.capa.in_progress")}</SelectItem>
              <SelectItem value="completed">{t("status.capa.completed")}</SelectItem>
              <SelectItem value="overdue">{t("status.capa.overdue")}</SelectItem>
              <SelectItem value="closed">{t("status.capa.closed")}</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <FilterCountBadge count={activeCount} />
            <Link href="/capa" className={buttonVariants({ variant: "outline" })}>
              {t("common.clearFilters")}
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
