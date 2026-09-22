"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { KanbanBoard, type KanbanCardData } from "@/components/ui/kanban-board";
import { setCapaCompletedAction } from "./actions";
import type { CapaRowData } from "./capa-table";
import { useT } from "@/lib/i18n/locale-context";

function fmtDate(d: Date | null) {
  if (!d) return null;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function isOverdue(row: CapaRowData) {
  if (row.status === "completed" || row.status === "closed" || !row.dueDate) return false;
  return row.dueDate.getTime() < Date.now();
}

export function CapaBoard({ items, canEdit }: { items: CapaRowData[]; canEdit: boolean }) {
  const t = useT();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const cards: KanbanCardData[] = items.map((row) => {
    const due = fmtDate(row.dueDate);
    const completed = fmtDate(row.completionDate);
    return {
      id: row.id,
      columnId: row.status === "completed" || row.status === "closed" ? "completed" : "open",
      title: row.action,
      subtitle: row.area,
      overdue: isOverdue(row),
      badges: [
        ...(row.responsibleDept ? [{ label: row.responsibleDept }] : []),
        ...(row.classification ? [{ label: row.classification }] : []),
      ],
      footer: completed ? `${t("capa.table.confirmedDate")}: ${completed}` : due ? `${t("capa.table.due")}: ${due}` : null,
    };
  });

  function move(cardId: string, toColumnId: string) {
    setPendingId(cardId);
    startTransition(async () => {
      try {
        await setCapaCompletedAction(cardId, toColumnId === "completed");
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
          { id: "open", label: t("capa.kpi.open"), accentClass: "bg-amber-500/10 text-amber-600" },
          { id: "completed", label: t("capa.kpi.completed"), accentClass: "bg-green-500/10 text-green-600" },
        ]}
        cards={cards}
        canMove={canEdit}
        onMove={move}
        pendingCardId={pendingId}
      />
    </div>
  );
}
