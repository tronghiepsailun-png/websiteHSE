"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { T } from "@/components/i18n/t";
import { useT } from "@/lib/i18n/locale-context";
import { createRecordTypeAction } from "./actions";

type Group = { id: string; code: string; name: string };

export function TypeForm({ groups }: { groups: Group[] }) {
  const t = useT();

  return (
    <form action={createRecordTypeAction} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="flex flex-col gap-1.5">
        <Label>{t("records.catalog.fields.group")}</Label>
        <Select name="groupId" defaultValue={groups[0]?.id}>
          <SelectTrigger>
            <SelectValue>{(v: string) => groups.find((g) => g.id === v)?.name ?? v}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {groups.map((g) => (
              <SelectItem key={g.id} value={g.id}>
                {g.code} · {g.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="code">{t("records.catalog.fields.code")}</Label>
        <Input id="code" name="code" required />
      </div>
      <div className="flex flex-col gap-1.5 lg:col-span-2">
        <Label htmlFor="name">{t("records.catalog.fields.name")}</Label>
        <Input id="name" name="name" required />
      </div>
      <div className="flex flex-col gap-1.5 lg:col-span-2">
        <Label htmlFor="legalBasis">{t("records.catalog.fields.legalBasis")}</Label>
        <Input id="legalBasis" name="legalBasis" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="frequencyLabel">{t("records.catalog.fields.frequencyLabel")}</Label>
        <Input id="frequencyLabel" name="frequencyLabel" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cycleMonths">{t("records.catalog.fields.cycleMonths")}</Label>
        <Input id="cycleMonths" name="cycleMonths" type="number" min={0} />
      </div>
      <div className="flex flex-col gap-1.5 lg:col-span-2">
        <Label htmlFor="responsibleUnit">{t("records.catalog.fields.responsibleUnit")}</Label>
        <Input id="responsibleUnit" name="responsibleUnit" />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="sharedAcrossSites" />
        {t("records.catalog.fields.sharedAcrossSites")}
      </label>
      <div className="flex items-end lg:col-span-4 lg:justify-end">
        <Button type="submit">
          <T k="records.catalog.addType" />
        </Button>
      </div>
    </form>
  );
}
