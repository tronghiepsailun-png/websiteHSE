"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useT } from "@/lib/i18n/locale-context";
import { createOrgUnitAction } from "./actions";

type UnitType = { id: string; name: string };
type Unit = { id: string; name: string };

export function AddUnitForm({ unitTypes, units }: { unitTypes: UnitType[]; units: Unit[] }) {
  const t = useT();

  return (
    <form action={createOrgUnitAction} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_2fr_1fr_1fr_auto] sm:items-end">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="u-code">{t("common.code")}</Label>
        <Input id="u-code" name="code" placeholder="A-SITE-1" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="u-name">{t("common.name")}</Label>
        <Input id="u-name" name="name" placeholder={t("admin.orgUnits.unitNamePlaceholder")} required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>{t("common.type")}</Label>
        <Select name="unitTypeId" required>
          <SelectTrigger>
            <SelectValue placeholder={t("admin.orgUnits.selectType")}>
              {(value: string) => unitTypes.find((type) => type.id === value)?.name ?? value}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {unitTypes.map((type) => (
              <SelectItem key={type.id} value={type.id}>
                {type.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>{t("admin.orgUnits.parentOptional")}</Label>
        <Select name="parentId" defaultValue="none">
          <SelectTrigger>
            <SelectValue placeholder={t("common.none")}>
              {(value: string) => (value === "none" ? t("common.none") : (units.find((u) => u.id === value)?.name ?? value))}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t("common.none")}</SelectItem>
            {units.map((unit) => (
              <SelectItem key={unit.id} value={unit.id}>
                {unit.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit">{t("admin.orgUnits.addUnit")}</Button>
    </form>
  );
}
