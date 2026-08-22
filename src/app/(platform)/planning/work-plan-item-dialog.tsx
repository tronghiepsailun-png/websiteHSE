"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { createWorkPlanItemAction, updateWorkPlanItemAction, type ItemFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FieldError } from "@/components/ui/field-error";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { WORK_PLAN_STATUSES, WORK_PLAN_PROGRESS_MILESTONES, type WorkPlanStatus } from "@/lib/work-plan-constants";
import { useT } from "@/lib/i18n/locale-context";
import type { DictionaryKey } from "@/lib/i18n/translate";

type ItemValues = {
  id: string;
  phase: string | null;
  title: string;
  responsibleName: string | null;
  startDate: Date | null;
  endDate: Date | null;
  status: string;
  progressPercent: number;
  notes: string | null;
};

function toDateInputValue(d: Date | null) {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export function WorkPlanItemDialog({
  documentId,
  phaseOptions,
  item,
}: {
  documentId: string;
  phaseOptions: string[];
  item?: ItemValues;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState(item?.progressPercent ?? 0);
  const isEdit = !!item;
  const action = isEdit ? updateWorkPlanItemAction : createWorkPlanItemAction;
  const [state, formAction, pending] = useActionState<ItemFormState, FormData>(action, undefined);

  useEffect(() => {
    if (open && state && "success" in state) setOpen(false);
  }, [state, open]);

  const errorState = state && "error" in state ? state : undefined;

  return (
    <Dialog open={open} onOpenChange={setOpen} disablePointerDismissal>
      <DialogTrigger
        render={
          isEdit ? (
            <Button type="button" variant="ghost" size="icon" className="size-7" title={t("common.edit")}>
              <Pencil className="size-3.5" />
            </Button>
          ) : (
            <Button type="button" size="sm">
              <Plus className="size-4" />
              {t("workplan.addButton")}
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? t("workplan.editItem.title") : t("workplan.new.title")}</DialogTitle>
          <DialogDescription>{t("workplan.new.subtitle")}</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="documentId" value={documentId} />
          {isEdit && <input type="hidden" name="id" value={item.id} />}

          <Field label={t("workplan.fields.title")}>
            <Input name="title" defaultValue={item?.title} required aria-invalid={!!errorState?.fieldErrors?.title} />
            <FieldError kind={errorState?.fieldErrors?.title} />
          </Field>

          <Field label={t("workplan.fields.phase")}>
            <Input name="phase" defaultValue={item?.phase ?? ""} placeholder={t("workplan.fields.phasePlaceholder")} list="workplan-phase-options" />
            <datalist id="workplan-phase-options">
              {phaseOptions.map((p) => <option key={p} value={p} />)}
            </datalist>
          </Field>

          <Field label={t("workplan.fields.responsibleName")}>
            <Input name="responsibleName" defaultValue={item?.responsibleName ?? ""} placeholder={t("workplan.fields.responsibleNamePlaceholder")} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t("workplan.fields.startDate")}>
              <Input name="startDate" type="date" defaultValue={toDateInputValue(item?.startDate ?? null)} />
            </Field>
            <Field label={t("workplan.fields.endDate")}>
              <Input name="endDate" type="date" defaultValue={toDateInputValue(item?.endDate ?? null)} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t("common.status")}>
              <Select name="status" defaultValue={item?.status ?? "not_started"}>
                <SelectTrigger className="w-full">
                  <SelectValue>{(value: string) => t(`workplan.status.${value}` as DictionaryKey)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {WORK_PLAN_STATUSES.map((s: WorkPlanStatus) => (
                    <SelectItem key={s} value={s}>{t(`workplan.status.${s}` as DictionaryKey)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t("workplan.fields.progressPercent")}>
              <input type="hidden" name="progressPercent" value={progress} />
              <div className="flex flex-wrap gap-1 pt-1.5">
                {WORK_PLAN_PROGRESS_MILESTONES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setProgress(m)}
                    className={cn(
                      "rounded-md px-2 py-1 text-xs font-semibold tabular-nums transition-colors",
                      m === progress
                        ? "bg-success/20 text-success ring-1 ring-success/50"
                        : "bg-muted text-muted-foreground hover:bg-muted/70"
                    )}
                  >
                    {m}%
                  </button>
                ))}
              </div>
            </Field>
          </div>

          <Field label={t("workplan.fields.notes")}>
            <Textarea name="notes" defaultValue={item?.notes ?? ""} rows={2} placeholder={t("workplan.progress.notePlaceholder")} />
          </Field>

          {errorState && <p className="text-sm text-destructive">{errorState.error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? t("common.saving") : t("workplan.new.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
