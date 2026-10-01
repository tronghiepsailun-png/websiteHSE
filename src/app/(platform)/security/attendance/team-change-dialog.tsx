"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/locale-context";
import { changeGuardTeamAction, deleteGuardTeamChangeAction } from "./actions";

const TEAMS = ["A", "B", "C"] as const;
const NO_SWAP = "__none__";

export type GuardOption = { id: string; fullName: string; fullNameZh: string | null; currentTeam: string | null };
export type TeamHistoryItem = { id: string; team: string; effectiveFrom: string; notes: string | null };

function formatDate(isoDate: string) {
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

/** The "Ca" column cell of the Chấm công grid: shows the guard's team for this month (and any
 *  change that starts inside it, e.g. "B → C từ 15"), and for managers opens the team-change
 *  dialog — move the guard to another team from a chosen date, optionally swapping with a guard
 *  of that team, and see/undo earlier changes. */
export function TeamCell({
  guard,
  startTeam,
  teamChanges,
  history,
  guards,
  today,
  canManage,
}: {
  guard: GuardOption;
  startTeam: string | null;
  teamChanges: { day: number; from: string | null; to: string | null }[];
  history: TeamHistoryItem[];
  guards: GuardOption[];
  today: string;
  canManage: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [team, setTeam] = useState<string>("");
  const [effectiveFrom, setEffectiveFrom] = useState(today);
  const [swapWithId, setSwapWithId] = useState(NO_SWAP);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const prefix = t("attendance.team.prefix");
  const label = (
    <span className="flex flex-col items-center leading-tight">
      <span>{startTeam ? `${prefix} ${startTeam}` : "—"}</span>
      {teamChanges.map((c) => (
        <span key={c.day} className="text-[10px] font-semibold whitespace-nowrap text-amber-600 dark:text-amber-400">
          → {c.to ?? "—"} ({String(c.day).padStart(2, "0")})
        </span>
      ))}
    </span>
  );

  if (!canManage) return label;

  const swapOptions = guards.filter((g) => g.id !== guard.id && team && g.currentTeam === team);

  function openDialog() {
    setTeam("");
    setEffectiveFrom(today);
    setSwapWithId(NO_SWAP);
    setNotes("");
    setError(null);
    setOpen(true);
  }

  function run(fn: () => Promise<{ error: string } | { success: true }>, close: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if ("error" in result) {
        setError(result.error);
        return;
      }
      if (close) setOpen(false);
      router.refresh();
    });
  }

  function save() {
    if (!team) {
      setError(t("attendance.teamChange.errorTeam"));
      return;
    }
    run(
      () =>
        changeGuardTeamAction({
          employeeId: guard.id,
          team: team as (typeof TEAMS)[number],
          effectiveFrom,
          swapWithId: swapWithId === NO_SWAP ? undefined : swapWithId,
          notes,
        }),
      true
    );
  }

  const guardLabel = (g: GuardOption) => `${g.fullName}${g.currentTeam ? ` (${prefix} ${g.currentTeam})` : ""}`;

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        title={t("attendance.teamChange.title")}
        className="group flex w-full items-center justify-center gap-1 rounded-md px-1 py-1 hover:bg-muted"
      >
        {label}
        <Pencil className="size-3 shrink-0 opacity-40 group-hover:opacity-100" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="leading-snug">
              {t("attendance.teamChange.title")} — {guard.fullName}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              {t("attendance.teamChange.current")}: <span className="font-semibold text-foreground">{guard.currentTeam ? `${prefix} ${guard.currentTeam}` : "—"}</span>
            </p>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label>{t("attendance.teamChange.newTeam")}</Label>
            <div className="grid grid-cols-3 gap-2">
              {TEAMS.map((code) => (
                <button
                  key={code}
                  type="button"
                  disabled={code === guard.currentTeam}
                  onClick={() => {
                    setTeam(code);
                    setSwapWithId(NO_SWAP);
                  }}
                  className={cn(
                    "rounded-lg border py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                    team === code ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/30" : "hover:bg-muted"
                  )}
                >
                  {prefix} {code}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`team-from-${guard.id}`}>{t("attendance.teamChange.effectiveFrom")}</Label>
            <Input id={`team-from-${guard.id}`} type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} required />
            <p className="text-xs text-muted-foreground">{t("attendance.teamChange.effectiveHint")}</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="flex items-center gap-1.5">
              <ArrowRightLeft className="size-3.5" />
              {t("attendance.teamChange.swapWith")}
            </Label>
            <Select value={swapWithId} onValueChange={(v) => setSwapWithId(v ?? NO_SWAP)} disabled={!team}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {() => {
                    const partner = guards.find((g) => g.id === swapWithId);
                    return partner ? guardLabel(partner) : t("attendance.teamChange.noSwap");
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_SWAP}>{t("attendance.teamChange.noSwap")}</SelectItem>
                {swapOptions.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {guardLabel(g)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {swapWithId !== NO_SWAP && guard.currentTeam && (
              <p className="text-xs text-muted-foreground">
                {t("attendance.teamChange.swapHint", {
                  name: guards.find((g) => g.id === swapWithId)?.fullName ?? "",
                  team: `${prefix} ${guard.currentTeam}`,
                })}
              </p>
            )}
          </div>

          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder={t("attendance.teamChange.notesPlaceholder")} />

          {history.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label>{t("attendance.teamChange.history")}</Label>
              <ul className="flex flex-col gap-1">
                {history
                  .slice()
                  .reverse()
                  .map((h) => (
                    <li key={h.id} className="flex items-center gap-2 rounded-md border bg-muted/30 px-2.5 py-1.5 text-sm">
                      <span className="flex-1">
                        {t("attendance.teamChange.historyItem", { date: formatDate(h.effectiveFrom), team: `${prefix} ${h.team}` })}
                        {h.notes && <span className="block text-xs text-muted-foreground">{h.notes}</span>}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7 text-destructive"
                        disabled={pending}
                        title={t("attendance.teamChange.undo")}
                        aria-label={t("attendance.teamChange.undo")}
                        onClick={() => run(() => deleteGuardTeamChangeAction(h.id), false)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </li>
                  ))}
              </ul>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="button" onClick={save} disabled={pending || !team || !effectiveFrom}>
              {pending ? t("common.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
