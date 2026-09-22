"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { KanbanBoard, type KanbanCardData } from "@/components/ui/kanban-board";
import { setWorkPlanStatusAction } from "./actions";
import type { WorkPlanStatus } from "@/server/work-plan";
import { useT } from "@/lib/i18n/locale-context";

export type WorkPlanCardData = {
  id: string;
  title: string;
  phase: string | null;
  responsibleName: string | null;
  status: string;
  progressPercent: number;
  timeRange: string | null;
  overdue: boolean;
};

const COLUMN_ACCENTS: Record<WorkPlanStatus, string> = {
  not_started: "bg-muted text-muted-foreground",
  in_progress: "bg-blue-500/10 text-blue-600",
  delayed: "bg-amber-500/10 text-amber-600",
  completed: "bg-green-500/10 text-green-600",
};

const COLUMN_ORDER: WorkPlanStatus[] = ["not_started", "in_progress", "delayed", "completed"];

export function WorkPlanBoard({ items, canEdit }: { items: WorkPlanCardData[]; canEdit: boolean }) {
  const t = useT();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const cards: KanbanCardData[] = items.map((item) => ({
    id: item.id,
    columnId: item.status,
    title: item.title,
    subtitle: item.phase,
    overdue: item.overdue,
    badges: [
      ...(item.responsibleName ? [{ label: item.responsibleName }] : []),
      { label: `${item.progressPercent}%` },
    ],
    footer: item.timeRange,
  }));

  function move(cardId: string, toColumnId: string) {
    setPendingId(cardId);
    startTransition(async () => {
      try {
        await setWorkPlanStatusAction(cardId, toColumnId as WorkPlanStatus);
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
        columns={COLUMN_ORDER.map((status) => ({
          id: status,
          label: t(`workplan.status.${status}`),
          accentClass: COLUMN_ACCENTS[status],
        }))}
        cards={cards}
        canMove={canEdit}
        onMove={move}
        pendingCardId={pendingId}
      />
    </div>
  );
}
