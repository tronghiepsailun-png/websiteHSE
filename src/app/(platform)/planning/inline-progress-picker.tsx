"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setWorkPlanProgressAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { WORK_PLAN_PROGRESS_MILESTONES } from "@/lib/work-plan-constants";
import { useT } from "@/lib/i18n/locale-context";

/** Replaces free-form 0-100 entry with a fixed set of quick-pick milestones — clicking one
 *  immediately opens a small note panel (the item's one shared note) and, on save, sets both
 *  the progress percent and the note in a single request. */
export function InlineProgressPicker({ id, percent, notes }: { id: string; percent: number; notes: string | null }) {
  const t = useT();
  const router = useRouter();
  const [openAt, setOpenAt] = useState<number | null>(null);
  const [draft, setDraft] = useState(notes ?? "");
  const [pending, startTransition] = useTransition();

  function handleOpenChange(milestone: number, open: boolean) {
    if (open) {
      setDraft(notes ?? "");
      setOpenAt(milestone);
    } else if (openAt === milestone) {
      setOpenAt(null);
    }
  }

  function handleSave(milestone: number) {
    startTransition(async () => {
      await setWorkPlanProgressAction(id, milestone, draft);
      setOpenAt(null);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {WORK_PLAN_PROGRESS_MILESTONES.map((m) => (
        <Popover key={m} open={openAt === m} onOpenChange={(open) => handleOpenChange(m, open)}>
          <PopoverTrigger
            render={
              <button
                type="button"
                className={cn(
                  "rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums transition-colors",
                  m === percent
                    ? "bg-success/20 text-success ring-1 ring-success/50"
                    : "bg-muted text-muted-foreground hover:bg-muted/70"
                )}
              >
                {m}%
              </button>
            }
          />
          <PopoverContent className="w-64">
            <p className="text-xs font-medium text-muted-foreground">{t("workplan.progress.noteLabel", { percent: m })}</p>
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              placeholder={t("workplan.progress.notePlaceholder")}
            />
            <div className="flex justify-end">
              <Button type="button" size="sm" disabled={pending} onClick={() => handleSave(m)}>
                {pending ? t("common.saving") : t("common.save")}
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      ))}
    </div>
  );
}
