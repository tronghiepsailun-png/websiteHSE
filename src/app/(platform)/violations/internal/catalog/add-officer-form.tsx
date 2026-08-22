"use client";

import { addSafetyOfficerAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmployeeCombobox } from "@/components/employees/employee-combobox";
import { useT } from "@/lib/i18n/locale-context";

export function AddOfficerForm() {
  const t = useT();

  return (
    <form action={addSafetyOfficerAction} className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
      <div className="flex flex-col gap-1.5">
        <Label>{t("violations.catalog.employee")}</Label>
        <EmployeeCombobox
          name="employeeId"
          placeholder={t("violations.catalog.selectEmployeePlaceholder")}
          emptyLabel={t("incidents.new.noEmployeeMatch")}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="monthlySubsidyVnd">{t("violations.catalog.baseSubsidy")}</Label>
        <Input id="monthlySubsidyVnd" name="monthlySubsidyVnd" type="number" step="1000" min="0" defaultValue={500000} required />
      </div>
      <Button type="submit">{t("violations.catalog.addOfficer")}</Button>
    </form>
  );
}
