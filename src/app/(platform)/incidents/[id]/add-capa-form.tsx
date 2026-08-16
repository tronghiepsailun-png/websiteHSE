"use client";

import { createCapaFromIncidentAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useT } from "@/lib/i18n/locale-context";

export function AddCapaForm({ incidentId, employees }: { incidentId: string; employees: { id: string; fullName: string }[] }) {
  const t = useT();

  return (
    <form action={createCapaFromIncidentAction} className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
      <input type="hidden" name="incidentId" value={incidentId} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="capa-action">{t("incidents.detail.actionLabel")}</Label>
        <Input id="capa-action" name="action" placeholder={t("incidents.detail.capaActionPlaceholder")} required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>{t("incidents.detail.capaResponsible")}</Label>
        <Select name="responsiblePersonId">
          <SelectTrigger>
            <SelectValue placeholder={t("common.unassigned")}>
              {(value: string) => employees.find((e) => e.id === value)?.fullName ?? value}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.fullName}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="capa-due">{t("incidents.detail.dueDate")}</Label>
        <Input id="capa-due" name="dueDate" type="date" />
      </div>
      <Button type="submit" size="sm">{t("incidents.detail.addCapa")}</Button>
    </form>
  );
}
