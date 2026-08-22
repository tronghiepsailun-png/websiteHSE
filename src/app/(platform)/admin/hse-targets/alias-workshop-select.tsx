"use client";

import { useRef } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useT } from "@/lib/i18n/locale-context";
import { updateDepartmentAliasAction } from "./actions";

export function AliasWorkshopSelect({
  aliasId,
  value,
  workshops,
}: {
  aliasId: string;
  value: string | null;
  workshops: { id: string; name: string }[];
}) {
  const t = useT();
  const formRef = useRef<HTMLFormElement>(null);
  const submitOnChange = () => setTimeout(() => formRef.current?.requestSubmit(), 0);
  const nameById = new Map(workshops.map((w) => [w.id, w.name]));

  return (
    <form ref={formRef} action={updateDepartmentAliasAction}>
      <input type="hidden" name="id" value={aliasId} />
      <Select
        key={`alias-${aliasId}-${value ?? "none"}`}
        name="safetyWorkshopId"
        defaultValue={value ?? "unclassified"}
        onValueChange={submitOnChange}
      >
        <SelectTrigger className="w-64">
          <SelectValue placeholder={t("incidents.report.score.workshopCol")}>
            {(v: string) => (v === "unclassified" ? t("admin.hseTargets.unclassified") : (nameById.get(v) ?? v))}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="unclassified">{t("admin.hseTargets.unclassified")}</SelectItem>
          {workshops.map((w) => (
            <SelectItem key={w.id} value={w.id}>
              {w.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </form>
  );
}
