"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { KanbanBoard, type KanbanCardData } from "@/components/ui/kanban-board";
import { setIncidentStatusAction } from "./[id]/actions";
import { useT } from "@/lib/i18n/locale-context";

export type IncidentCardData = {
  id: string;
  incidentNumber: string;
  status: string;
  occurredAt: Date;
  department: string | null;
  severity: string | null;
  category: string | null;
  description: string;
};

function fmtDate(d: Date) {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export function IncidentsBoard({ items, canEdit }: { items: IncidentCardData[]; canEdit: boolean }) {
  const t = useT();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const cards: KanbanCardData[] = items.map((row) => ({
    id: row.id,
    columnId: row.status === "closed" ? "closed" : "investigating",
    title: row.incidentNumber,
    subtitle: row.description,
    href: `/incidents/${row.id}`,
    badges: [
      ...(row.department ? [{ label: row.department }] : []),
      ...(row.severity ? [{ label: row.severity }] : []),
      ...(row.category ? [{ label: row.category }] : []),
    ],
    footer: fmtDate(row.occurredAt),
  }));

  function move(cardId: string, toColumnId: string) {
    setPendingId(cardId);
    startTransition(async () => {
      try {
        await setIncidentStatusAction(cardId, toColumnId === "closed" ? "closed" : "investigating");
      } catch {
        toast.error(t("kanban.saveFailed"));
      } finally {
        setPendingId(null);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {canEdit && <p className="text-xs text-muted-foreground">{t("kanban.dragHint")}</p>}
      <KanbanBoard
        columns={[
          { id: "investigating", label: t("status.incident.investigating"), accentClass: "bg-amber-500/10 text-amber-600" },
          { id: "closed", label: t("status.incident.closed"), accentClass: "bg-green-500/10 text-green-600" },
        ]}
        cards={cards}
        canMove={canEdit}
        onMove={move}
        pendingCardId={pendingId}
      />
    </div>
  );
}
