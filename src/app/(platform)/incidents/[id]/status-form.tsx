"use client";

import { updateIncidentAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useT } from "@/lib/i18n/locale-context";
import type { DictionaryKey } from "@/lib/i18n/translate";

type Incident = { id: string; updatedAt: Date; status: string };

export function StatusForm({ incident }: { incident: Incident }) {
  const t = useT();

  return (
    <form
      key={`${incident.id}-${incident.updatedAt.getTime()}`}
      action={updateIncidentAction}
      className="flex items-end gap-3"
    >
      <input type="hidden" name="incidentId" value={incident.id} />

      <div className="flex min-w-36 flex-col gap-1.5">
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
      <Button type="submit" size="sm">{t("common.saveChanges")}</Button>
    </form>
  );
}
