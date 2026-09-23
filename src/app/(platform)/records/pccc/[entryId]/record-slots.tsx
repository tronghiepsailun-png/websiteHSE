"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addMonths } from "date-fns";
import { Plus } from "lucide-react";
import { setEntrySlotFileAction, clearEntrySlotAction } from "./slots-actions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { FileInput } from "@/components/ui/file-input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/locale-context";

export type RecordSlotView = {
  slotIndex: number;
  id: string | null;
  fileName: string | null;
  storageType: string | null;
  url: string | null;
  startDate: string | null; // ISO date, already serialized by the server component
  expiresAt: string | null;
};

function toDateInputValue(value: Date | string | null): string {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

export function RecordSlotsGrid({
  entryId,
  slots,
  canManage,
  cycleMonths,
}: {
  entryId: string;
  slots: RecordSlotView[];
  canManage: boolean;
  /** The record type's renewal cycle — auto-fills "Ngày hết hạn" from "Ngày bắt đầu" the same
   *  way RecordVersion.expiresAt already computes server-side (see src/server/records.ts), so
   *  this popover doesn't force re-deriving/re-typing a date the cycle already determines. */
  cycleMonths: number | null;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {slots.map((slot) => (
        <RecordSlotBox key={slot.slotIndex} entryId={entryId} slot={slot} canManage={canManage} cycleMonths={cycleMonths} />
      ))}
    </div>
  );
}

function RecordSlotBox({
  entryId,
  slot,
  canManage,
  cycleMonths,
}: {
  entryId: string;
  slot: RecordSlotView;
  canManage: boolean;
  cycleMonths: number | null;
}) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(setEntrySlotFileAction, undefined);
  const [clearing, startClearing] = useTransition();
  const filled = !!slot.fileName;

  // "Ngày hết hạn" auto-fills from "Ngày bắt đầu" + the record type's cycle the instant a start
  // date is picked — still a plain editable field afterward (an authority-granted extension is
  // a real exception cycleMonths can't predict), but `expiresAtTouched` stops the auto-fill from
  // overwriting a value the user has deliberately typed themselves.
  const [startDate, setStartDate] = useState(toDateInputValue(slot.startDate));
  const [expiresAt, setExpiresAt] = useState(toDateInputValue(slot.expiresAt));
  const [expiresAtTouched, setExpiresAtTouched] = useState(false);

  useEffect(() => {
    setStartDate(toDateInputValue(slot.startDate));
    setExpiresAt(toDateInputValue(slot.expiresAt));
    setExpiresAtTouched(false);
  }, [slot.startDate, slot.expiresAt]);

  function handleStartDateChange(value: string) {
    setStartDate(value);
    if (!expiresAtTouched && cycleMonths && value) {
      setExpiresAt(toDateInputValue(addMonths(new Date(value), cycleMonths)));
    }
  }

  useEffect(() => {
    if (state && "success" in state) {
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);

  function handleClear() {
    startClearing(async () => {
      await clearEntrySlotAction(entryId, slot.slotIndex);
      setOpen(false);
      router.refresh();
    });
  }

  const fileHref = filled
    ? slot.storageType === "drive_link"
      ? (slot.url ?? "#")
      : `/api/records/slot-files/${slot.id}`
    : null;

  const box = (
    <div
      className={
        "flex h-24 flex-col items-center justify-center gap-1 rounded-md border p-2 text-center text-xs transition-colors " +
        (filled
          ? "border-success/30 bg-success/10 text-success hover:bg-success/15"
          : "border-dashed border-border/60 text-muted-foreground hover:border-border hover:bg-muted/40")
      }
    >
      {filled ? (
        <span className="line-clamp-2 font-medium">{slot.fileName}</span>
      ) : (
        <>
          <Plus className="h-4 w-4" strokeWidth={2} />
          <span>{t("records.slots.slotLabel", { n: slot.slotIndex })}</span>
        </>
      )}
    </div>
  );

  if (!canManage) {
    return fileHref ? (
      <a href={fileHref} target="_blank" rel="noopener noreferrer" className="hover:opacity-80">
        {box}
      </a>
    ) : (
      box
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<button type="button">{box}</button>} />
      <PopoverContent className="w-72">
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="entryId" value={entryId} />
          <input type="hidden" name="slotIndex" value={slot.slotIndex} />
          <p className="text-sm font-medium">{t("records.slots.slotLabel", { n: slot.slotIndex })}</p>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`file-${slot.slotIndex}`}>{t("records.form.fields.file")}</Label>
            <FileInput id={`file-${slot.slotIndex}`} name="file" accept=".pdf,.doc,.docx,.xls,.xlsx,image/*" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`start-${slot.slotIndex}`}>{t("records.slots.startDate")}</Label>
              <Input id={`start-${slot.slotIndex}`} name="startDate" type="date" value={startDate} onChange={(e) => handleStartDateChange(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`expires-${slot.slotIndex}`}>{t("records.slots.expiresAt")}</Label>
              <Input
                id={`expires-${slot.slotIndex}`}
                name="expiresAt"
                type="date"
                value={expiresAt}
                onChange={(e) => {
                  setExpiresAt(e.target.value);
                  setExpiresAtTouched(true);
                }}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{t("records.slots.expiresAtHint")}</p>

          {fileHref && (
            <a href={fileHref} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
              {t("records.detail.viewFile")}
            </a>
          )}

          {state && "error" in state && <p className="text-xs text-destructive">{state.error}</p>}

          <div className="flex items-center justify-between gap-2">
            {filled ? (
              <Button type="button" variant="outline" size="sm" disabled={clearing || pending} onClick={handleClear}>
                {t("common.delete")}
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" size="sm" disabled={pending || clearing}>
              {pending ? t("common.saving") : t("common.save")}
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
