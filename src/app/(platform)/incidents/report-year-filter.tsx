"use client";

import { useRef } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useT } from "@/lib/i18n/locale-context";

export function ReportYearFilter({ view, year, availableYears }: { view: string; year: number; availableYears: number[] }) {
  const t = useT();
  const formRef = useRef<HTMLFormElement>(null);
  const submitOnChange = () => setTimeout(() => formRef.current?.requestSubmit(), 0);

  return (
    <form ref={formRef} action="/incidents" className="flex items-center gap-2">
      <input type="hidden" name="view" value={view} />
      <Select key={`year-${year}`} name="year" defaultValue={String(year)} onValueChange={submitOnChange}>
        <SelectTrigger className="w-36">
          <SelectValue placeholder={t("incidents.report.yearLabel")} />
        </SelectTrigger>
        <SelectContent>
          {availableYears.map((y) => (
            <SelectItem key={y} value={String(y)}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </form>
  );
}
