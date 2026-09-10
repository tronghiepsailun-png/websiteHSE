"use client";

import { useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useT } from "@/lib/i18n/locale-context";

export function MonthFilter({
  year,
  month,
  options,
}: {
  year: number;
  month: number;
  options: { year: number; month: number }[];
}) {
  const t = useT();
  const formRef = useRef<HTMLFormElement>(null);
  const value = `${year}-${month}`;

  return (
    <Card>
      <CardContent className="p-3">
        <form ref={formRef} className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{t("violations.monthFilter.label")}</span>
          {/* Keyed on the period so a programmatic navigation to a different month (e.g. after
              saving a row whose date falls outside the month being viewed) remounts this
              uncontrolled Select with the right defaultValue, instead of it silently keeping
              the stale label from before the navigation. */}
          <Select
            key={value}
            name="ym"
            defaultValue={value}
            onValueChange={() => setTimeout(() => formRef.current?.requestSubmit(), 0)}
          >
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
        </form>
      </CardContent>
    </Card>
  );
}
