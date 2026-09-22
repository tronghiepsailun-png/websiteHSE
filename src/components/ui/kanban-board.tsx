"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/locale-context";

export type KanbanColumnDef = {
  id: string;
  label: string;
  /** Tailwind classes for the column's header chip, e.g. "bg-green-500/10 text-green-600". */
  accentClass?: string;
};

export type KanbanCardData = {
  id: string;
  columnId: string;
  title: string;
  subtitle?: string | null;
  /** Small pills under the title — status, department, classification, ... */
  badges?: { label: string; className?: string }[];
  footer?: ReactNode;
  /** Draws the card in the destructive tone and shows the overdue pill. */
  overdue?: boolean;
  /** When set, the card title links to the record's detail page. */
  href?: string;
};

/** Board view shared by the modules that track work through a small set of states. Cards move
 *  with native HTML5 drag & drop (no extra dependency); `onMove` receives the drop and is
 *  responsible for persisting it — the board itself keeps no copy of the data. */
export function KanbanBoard({
  columns,
  cards,
  canMove = false,
  onMove,
  pendingCardId,
}: {
  columns: KanbanColumnDef[];
  cards: KanbanCardData[];
  canMove?: boolean;
  onMove?: (cardId: string, toColumnId: string) => void;
  /** Card currently being saved — dimmed so the move reads as in-flight. */
  pendingCardId?: string | null;
}) {
  const t = useT();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  function handleDrop(e: React.DragEvent, columnId: string) {
    // The id travels on the drag event itself rather than in state: a drop handler closes over
    // the render it was created in, so state set during dragstart may not be visible yet.
    const cardId = e.dataTransfer.getData("text/plain") || draggingId;
    setDraggingId(null);
    setDragOverColumn(null);
    if (!cardId || !onMove) return;
    const card = cards.find((c) => c.id === cardId);
    if (!card || card.columnId === columnId) return;
    onMove(cardId, columnId);
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {columns.map((column) => {
        const columnCards = cards.filter((card) => card.columnId === column.id);
        const isTarget = dragOverColumn === column.id;
        return (
          <section
            key={column.id}
            onDragOver={(e) => {
              if (!canMove) return;
              e.preventDefault();
              setDragOverColumn(column.id);
            }}
            onDragLeave={() => setDragOverColumn((current) => (current === column.id ? null : current))}
            onDrop={(e) => {
              e.preventDefault();
              handleDrop(e, column.id);
            }}
            className={cn(
              "flex min-h-40 flex-col gap-3 rounded-xl border bg-card p-3 transition-colors",
              isTarget && "border-primary bg-primary/5"
            )}
          >
            <header className="flex items-center justify-between gap-2">
              <span className={cn("rounded-lg px-2 py-1 text-xs font-semibold", column.accentClass ?? "bg-muted text-muted-foreground")}>{column.label}</span>
              <span className="text-xs text-muted-foreground">{columnCards.length}</span>
            </header>

            <div className="flex flex-col gap-2">
              {columnCards.map((card) => (
                <article
                  key={card.id}
                  draggable={canMove}
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", card.id);
                    e.dataTransfer.effectAllowed = "move";
                    setDraggingId(card.id);
                  }}
                  onDragEnd={() => {
                    setDraggingId(null);
                    setDragOverColumn(null);
                  }}
                  className={cn(
                    "rounded-lg border bg-background p-3 text-sm shadow-sm transition-opacity",
                    canMove && "cursor-grab active:cursor-grabbing",
                    card.overdue && "border-destructive/50",
                    (draggingId === card.id || pendingCardId === card.id) && "opacity-50"
                  )}
                >
                  <p className="font-medium">
                    {card.href ? (
                      <Link href={card.href} className="hover:underline">
                        {card.title}
                      </Link>
                    ) : (
                      card.title
                    )}
                  </p>
                  {card.subtitle && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{card.subtitle}</p>}

                  {(card.overdue || (card.badges && card.badges.length > 0)) && (
                    <div className="mt-2 flex flex-wrap items-center gap-1">
                      {card.overdue && (
                        <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[11px] font-medium text-destructive">{t("kanban.overdue")}</span>
                      )}
                      {card.badges?.map((badge) => (
                        <span key={badge.label} className={cn("rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground", badge.className)}>
                          {badge.label}
                        </span>
                      ))}
                    </div>
                  )}

                  {card.footer && <div className="mt-2 text-xs text-muted-foreground">{card.footer}</div>}
                </article>
              ))}

              {columnCards.length === 0 && (
                <p className="rounded-lg border border-dashed py-6 text-center text-xs text-muted-foreground">{t("kanban.columnEmpty")}</p>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
