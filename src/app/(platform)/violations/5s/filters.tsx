"use client";

import { useRef } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/locale-context";

/** Month selector (defaults to the current month, switchable to any period with real data)
 *  plus a free-text search across employee code/name/department. */
export function Safety5sFilters({
  year,
  month,
  search,
  options,
}: {
  year: number;
  month: number;
  search?: string;
  options: { year: number; month: number }[];
}) {
  const t = useT();
  const formRef = useRef<HTMLFormElement>(null);
  const value = `${year}-${month}`;

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-2 p-3">
        <form ref={formRef} className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">{t("violations.monthFilter.label")}</span>
          <Select key={value} name="ym" defaultValue={value} onValueChange={() => setTimeout(() => formRef.current?.requestSubmit(), 0)}>
            <SelectTrigger>
              <SelectValue>
                {(v: string) => {
                  const [y, m] = v.split("-");
                  return `${t("violations.monthFilter.month")} ${m}/${y}`;
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={`${o.year}-${o.month}`} value={`${o.year}-${o.month}`}>
                  {t("violations.monthFilter.month")} {o.month}/{o.year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input name="q" defaultValue={search ?? ""} placeholder={t("violationsLienDe.filter.searchPlaceholder")} className="w-56" />
          <Button type="submit" size="sm" variant="outline">
            {t("violationsLienDe.filter.apply")}
          </Button>
          {search && (
            <Link href={`/violations/5s?ym=${value}`} className="text-sm text-muted-foreground underline">
              {t("common.clearFilters")}
            </Link>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
