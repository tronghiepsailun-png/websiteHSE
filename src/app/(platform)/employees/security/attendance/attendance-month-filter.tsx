"use client";

import { useRef } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useT } from "@/lib/i18n/locale-context";

export function AttendanceMonthFilter({
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
    <form ref={formRef} className="flex items-center gap-2">
      <Select name="ym" defaultValue={value} onValueChange={() => setTimeout(() => formRef.current?.requestSubmit(), 0)}>
        <SelectTrigger className="w-40">
          <SelectValue>
            {(v: string) => {
              const [y, m] = v.split("-");
              return `${t("attendance.monthPrefix")} ${m}/${y}`;
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={`${o.year}-${o.month}`} value={`${o.year}-${o.month}`}>
              {t("attendance.monthPrefix")} {o.month}/{o.year}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </form>
  );
}
