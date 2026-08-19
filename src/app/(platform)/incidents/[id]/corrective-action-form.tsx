"use client";

import { updateIncidentAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/lib/i18n/locale-context";

type Incident = { id: string; updatedAt: Date; correctiveAction: string | null };

export function CorrectiveActionForm({ incident }: { incident: Incident }) {
  const t = useT();

  return (
    <form
      key={`${incident.id}-${incident.updatedAt.getTime()}`}
      action={updateIncidentAction}
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="incidentId" value={incident.id} />
      <Textarea name="correctiveAction" rows={3} defaultValue={incident.correctiveAction ?? ""} />
      <div className="flex justify-end">
        <Button type="submit" size="sm">{t("common.saveChanges")}</Button>
      </div>
    </form>
  );
}
