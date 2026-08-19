"use client";

import { updateIncidentAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useT } from "@/lib/i18n/locale-context";
import type { DictionaryKey } from "@/lib/i18n/translate";

type Employee = { id: string; name: string };
type Incident = {
  id: string;
  updatedAt: Date;
  status: string;
  responsiblePersonId: string | null;
  dueDate: Date | null;
  completionDate: Date | null;
};

function toDateInput(d: Date | null) {
  return d ? d.toISOString().slice(0, 10) : "";
}

export function StatusForm({ incident, employees }: { incident: Incident; employees: Employee[] }) {
  const t = useT();

  return (
    <form
      key={`${incident.id}-${incident.updatedAt.getTime()}`}
      action={updateIncidentAction}
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="incidentId" value={incident.id} />

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-36 flex-col gap-1.5">
          <Label>{t("common.status")}</Label>
          <Select name="status" defaultValue={incident.status}>
            <SelectTrigger>
              <SelectValue>{(value: string) => t(`status.incident.${value}` as DictionaryKey)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">{t("status.incident.open")}</SelectItem>
              <SelectItem value="investigating">{t("status.incident.investigating")}</SelectItem>
              <SelectItem value="action_pending">{t("status.incident.action_pending")}</SelectItem>
              <SelectItem value="closed">{t("status.incident.closed")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex min-w-44 flex-col gap-1.5">
          <Label>{t("incidents.detail.responsiblePerson")}</Label>
          <Select name="responsiblePersonId" defaultValue={incident.responsiblePersonId ?? undefined}>
            <SelectTrigger>
              <SelectValue placeholder={t("common.unassigned")}>
                {(value: string | null) => (value ? (employees.find((e) => e.id === value)?.name ?? value) : t("common.unassigned"))}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex min-w-36 flex-col gap-1.5">
          <Label htmlFor="dueDate">{t("incidents.detail.dueDate")}</Label>
          <Input id="dueDate" name="dueDate" type="date" defaultValue={toDateInput(incident.dueDate)} />
        </div>
        <div className="flex min-w-36 flex-col gap-1.5">
          <Label htmlFor="completionDate">{t("incidents.detail.completionDate")}</Label>
          <Input id="completionDate" name="completionDate" type="date" defaultValue={toDateInput(incident.completionDate)} />
        </div>
        <Button type="submit" size="sm">{t("common.saveChanges")}</Button>
      </div>
    </form>
  );
}
