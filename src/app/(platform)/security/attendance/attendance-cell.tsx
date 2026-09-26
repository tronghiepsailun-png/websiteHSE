"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sun, Moon } from "lucide-react";
import { setAttendanceStatusAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { AttendanceStatus } from "@/server/attendance";
import { DEFAULT_SHIFT_HOURS } from "@/lib/attendance-constants";
import { useT } from "@/lib/i18n/locale-context";
import type { DictionaryKey } from "@/lib/i18n/translate";

const WORKING_STYLE: Record<"day" | "night", { timeLabel: string; Icon: typeof Sun; iconClass: string }> = {
  day: { timeLabel: "08h-20h", Icon: Sun, iconClass: "text-amber-500" },
  night: { timeLabel: "20h-08h", Icon: Moon, iconClass: "text-blue-400" },
};

// A sun/moon glyph reads faster at a glance than hour digits — day vs. night shift is told
// apart by the icon alone, not by a colored frame around the whole cell.
const WORKING_CLASS = "border-border bg-muted/40";

/** One calendar-day cell — shows a sun/moon icon (not a bare N/Đ letter code or the raw hours)
 *  so anyone glancing at the sheet instantly sees who's on day vs. night shift, plus the actual
 *  worked hour count next to it (12 by default; red whenever it's been adjusted — came in late,
 *  left early — so the exception stands out at a glance). Clicking it opens a small panel with
 *  one ON/OFF toggle (using the date's own shift type — a date is never both day and night), an
 *  hours field, and a note field; the note then shows on hover too. A day that's off by default
 *  and has never been overridden renders as plain empty space — no border, no click target —
 *  since most cells for any one guard ARE off (2 of every 3 days) and giving each one a
 *  box/click target would make the grid all noise; a manually recorded off day keeps its box
 *  (red "OFF") since that's worth seeing and worth being able to revert. */
export function AttendanceCell({
  employeeId,
  date,
  status,
  defaultStatus,
  hours,
  notes,
  isOverride,
  disabled,
}: {
  employeeId: string;
  date: string;
  status: AttendanceStatus;
  defaultStatus: AttendanceStatus;
  hours: number;
  notes: string | null;
  isOverride: boolean;
  disabled?: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draftStatus, setDraftStatus] = useState<AttendanceStatus>(status);
  const [draftHours, setDraftHours] = useState(hours);
  const [draftNotes, setDraftNotes] = useState(notes ?? "");
  const [pending, startTransition] = useTransition();

  // The shift type ("day"/"night") this date works when turned ON — from the current status if
  // it's already working, otherwise falling back to the rotation's own default for this date.
  const onType: "day" | "night" = (status !== "off" ? status : defaultStatus !== "off" ? defaultStatus : "day") as
    | "day"
    | "night";

  function handleOpenChange(next: boolean) {
    if (next) {
      setDraftStatus(status);
      setDraftHours(hours);
      setDraftNotes(notes ?? "");
    }
    setOpen(next);
  }

  function handleSave() {
    const hoursToSave = Math.min(24, Math.max(1, Math.round(draftHours) || DEFAULT_SHIFT_HOURS));
    startTransition(async () => {
      await setAttendanceStatusAction(employeeId, date, draftStatus, hoursToSave, draftNotes);
      setOpen(false);
      router.refresh();
    });
  }

  const isWorking = status !== "off";
  // Red text/pill alone was too easy to miss at this size — any exception (an adjusted shift,
  // or a manually recorded off day) now also gets a red border around the whole cell so it's
  // obvious without having to read the number or badge first.
  const hasAnomalousHours = isWorking && hours !== DEFAULT_SHIFT_HOURS;
  const isManualOff = isOverride && !isWorking;
  const hasRedBorder = hasAnomalousHours || isManualOff;
  const statusLabel = t(`attendance.legend.${status}` as DictionaryKey);
  const title = isWorking
    ? `${date} — ${statusLabel} (${hours}h)${notes ? `: ${notes}` : ""}`
    : notes
      ? `${date} — ${statusLabel}: ${notes}`
      : `${date} — ${statusLabel}`;

  function renderCellContent(workingType: "day" | "night") {
    const { Icon, iconClass } = WORKING_STYLE[workingType];
    return (
      <>
        <span className="flex items-center justify-center gap-1">
          <Icon className={cn("h-4 w-4", iconClass)} strokeWidth={2.25} />
          <span className={cn("text-[10px] leading-none font-bold", hours === DEFAULT_SHIFT_HOURS ? "text-foreground" : "text-red-500")}>
            {hours}
          </span>
        </span>
        <span className="rounded-full bg-green-500 px-1.5 py-0.5 text-[9px] leading-none font-bold text-white">ON</span>
      </>
    );
  }

  // A default off day (no override) has nothing to say and nothing to do — no border, no
  // hover, no click target, just empty space, so the grid isn't wall-to-wall boxes. Once a
  // manager has actively switched a normally-working day to off (sick leave, swap...), that IS
  // worth flagging and worth being able to revert, so it keeps its box and click target.
  if (!isWorking && !isOverride) {
    return <div className="h-10 w-full" />;
  }

  // A blank cell means "off by default, nothing to say" — but once a manager has actively
  // switched a normally-working day to off (sick leave, swap...), that's worth flagging, not
  // hiding: a red "OFF" tag replaces the blank box so a gap in coverage is visible at a glance.
  const cellContent = isWorking
    ? renderCellContent(status as "day" | "night")
    : <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] leading-none font-bold text-white">OFF</span>;

  if (disabled) {
    return (
      <div
        title={title}
        className={cn(
          "box-border flex h-10 w-full flex-col items-center justify-center gap-0.5 overflow-hidden rounded-md border",
          hasRedBorder ? "border-2 border-red-500 bg-muted/40" : WORKING_CLASS,
          isOverride && "ring-1 ring-foreground/30"
        )}
      >
        {cellContent}
      </div>
    );
  }

  const draftWorking = draftStatus !== "off";
  const draftStyle = WORKING_STYLE[onType];
  const DraftIcon = draftStyle.Icon;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <button
            type="button"
            title={title}
            className={cn(
              "box-border flex h-10 w-full flex-col items-center justify-center gap-0.5 overflow-hidden rounded-md border transition-colors hover:brightness-125",
              hasRedBorder ? "border-2 border-red-500 bg-muted/40" : WORKING_CLASS,
              isOverride && "ring-1 ring-foreground/30"
            )}
          >
            {cellContent}
          </button>
        }
      />
      <PopoverContent className="w-56">
        <p className="text-xs font-medium text-muted-foreground">{date}</p>
        <button
          type="button"
          onClick={() => setDraftStatus(draftWorking ? "off" : onType)}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold transition-colors",
            draftWorking
              ? "border-primary/40 bg-primary/10 text-foreground ring-1 ring-primary/20"
              : "border-red-500/40 bg-red-500/10 text-red-500 ring-1 ring-red-500/20"
          )}
        >
          {draftWorking && <DraftIcon className={cn("h-4 w-4", draftStyle.iconClass)} strokeWidth={2.25} />}
          {draftWorking ? `ON · ${draftStyle.timeLabel}` : "OFF"}
        </button>
        {draftWorking && (
          <label className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            {t("attendance.fields.hours")}
            <Input
              type="number"
              min={1}
              max={24}
              value={draftHours}
              onChange={(e) => setDraftHours(Number(e.target.value))}
              className="h-7 w-16 text-center"
            />
          </label>
        )}
        <Textarea
          value={draftNotes}
          onChange={(e) => setDraftNotes(e.target.value)}
          rows={3}
          placeholder={t("attendance.notesPlaceholder")}
        />
        <div className="flex justify-end">
          <Button type="button" size="sm" disabled={pending} onClick={handleSave}>
            {pending ? t("common.saving") : t("common.save")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
