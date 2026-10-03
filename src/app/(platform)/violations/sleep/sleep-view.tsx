"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ColumnVisibilityMenu } from "@/components/ui/column-visibility-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { EmployeeCombobox } from "@/components/employees/employee-combobox";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/locale-context";
import { deleteSleepViolationAction, getSleepEmployeeDetailsAction, saveSleepViolationAction } from "./actions";
import { SLEEP_COLUMNS_COOKIE, SLEEP_TOGGLEABLE_COLUMNS, type SleepColumnId } from "./column-visibility";

export type SleepRow = {
  id: string;
  checkDate: string; // YYYY-MM-DD
  checkTime: string | null;
  location: string | null;
  employeeId: string | null;
  employeeCode: string | null;
  employeeName: string;
  factory: string | null;
  department: string | null;
  position: string | null;
  fineAmountVnd: number | null;
  note: string | null;
  liableEmployeeId: string | null;
  liableCode: string | null;
  liableName: string | null;
  liableFineVnd: number | null;
  guardCatalogId: string | null;
  guardCode: string | null;
  guardNameZh: string | null;
  guardNameVi: string | null;
  guardColor: string | null;
  guardRewardVnd: number | null;
  remark: string | null;
};

export type PresetOption = { value: string; label: string };
export type NotePreset = { vi: string; zh: string | null };
export type GuardOption = { id: string; code: string | null; nameVi: string; nameZh: string | null; color: string | null };

export type SleepCatalogs = {
  locations: PresetOption[];
  notes: NotePreset[];
  guards: GuardOption[];
  defaults: { fine: number; liable: number; reward: number };
};

const NO_GUARD = "__none__";
const CUSTOM_NOTE = "__custom__";
const NO_NOTE = "__empty__";

function vnd(n: number | null) {
  return n === null ? "" : n.toLocaleString("vi-VN");
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d}/${m}/${y}`;
}

function fillNote(text: string, iso: string) {
  const [, m] = iso.split("-").map(Number);
  return text.replaceAll("{thang}", String(m)).replaceAll("{ngay}", formatDate(iso));
}

function noteText(p: NotePreset, iso: string) {
  return [fillNote(p.vi, iso), p.zh].filter(Boolean).join("\n");
}

function todayIso() {
  return new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
}

function numberOrNull(v: string) {
  const n = Number(v.replace(/[^\d]/g, ""));
  return v.trim() === "" || Number.isNaN(n) ? null : n;
}

export function SleepView({
  rows,
  catalogs,
  canEdit,
  canDelete,
  hiddenColumns,
  year,
  month,
}: {
  rows: SleepRow[];
  catalogs: SleepCatalogs;
  canEdit: boolean;
  canDelete: boolean;
  hiddenColumns: SleepColumnId[];
  year: number;
  month: number;
}) {
  const t = useT();
  const router = useRouter();
  const hidden = new Set(hiddenColumns);
  const show = (id: SleepColumnId) => !hidden.has(id);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, startDelete] = useTransition();
  const canManage = canEdit || canDelete;
  const columnCount = 6 + SLEEP_TOGGLEABLE_COLUMNS.length - hidden.size + (canManage ? 1 : 0);

  function saved(y: number, m: number) {
    setAdding(false);
    setEditingId(null);
    if (y !== year || m !== month) router.push(`/violations/sleep?ym=${y}-${m}`);
    else router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <ColumnVisibilityMenu columns={SLEEP_TOGGLEABLE_COLUMNS} hiddenColumns={hiddenColumns} cookieName={SLEEP_COLUMNS_COOKIE} />
        {canEdit && !adding && !editingId && (
          <Button type="button" size="sm" onClick={() => setAdding(true)}>
            <Plus className="size-4" />
            {t("sleep.add")}
          </Button>
        )}
      </div>

      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow className="h-11">
              <TableHead className="w-10">{t("sleep.col.stt")}</TableHead>
              <TableHead>{t("sleep.col.date")}</TableHead>
              {show("time") && <TableHead>{t("sleep.col.time")}</TableHead>}
              {show("location") && <TableHead>{t("sleep.col.location")}</TableHead>}
              <TableHead>{t("sleep.col.employeeCode")}</TableHead>
              <TableHead>{t("sleep.col.employeeName")}</TableHead>
              {show("factory") && <TableHead>{t("sleep.col.factory")}</TableHead>}
              {show("department") && <TableHead>{t("sleep.col.department")}</TableHead>}
              {show("position") && <TableHead>{t("sleep.col.position")}</TableHead>}
              <TableHead className="text-right">{t("sleep.col.fine")}</TableHead>
              {show("note") && <TableHead>{t("sleep.col.note")}</TableHead>}
              {show("liableCode") && <TableHead>{t("sleep.col.liableCode")}</TableHead>}
              {show("liableName") && <TableHead>{t("sleep.col.liableName")}</TableHead>}
              {show("liableFine") && <TableHead className="text-right">{t("sleep.col.liableFine")}</TableHead>}
              {show("guard") && <TableHead>{t("sleep.col.guard")}</TableHead>}
              {show("reward") && <TableHead className="text-right">{t("sleep.col.reward")}</TableHead>}
              {show("remark") && <TableHead>{t("sleep.col.remark")}</TableHead>}
              {canManage && <TableHead className="w-16" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {adding && <EditRow stt={rows.length + 1} row={null} catalogs={catalogs} show={show} onCancel={() => setAdding(false)} onSaved={saved} />}

            {rows.map((r, i) =>
              editingId === r.id ? (
                <EditRow key={r.id} stt={i + 1} row={r} catalogs={catalogs} show={show} onCancel={() => setEditingId(null)} onSaved={saved} />
              ) : (
                <TableRow key={r.id} className="h-12">
                  <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                  <TableCell>{formatDate(r.checkDate)}</TableCell>
                  {show("time") && <TableCell>{r.checkTime}</TableCell>}
                  {show("location") && <TableCell>{r.location}</TableCell>}
                  <TableCell>{r.employeeCode}</TableCell>
                  <TableCell className="font-medium">{r.employeeName}</TableCell>
                  {show("factory") && <TableCell className="text-muted-foreground">{r.factory}</TableCell>}
                  {show("department") && <TableCell className="text-muted-foreground">{r.department}</TableCell>}
                  {show("position") && <TableCell className="text-muted-foreground">{r.position}</TableCell>}
                  <TableCell className="text-right">{vnd(r.fineAmountVnd)}</TableCell>
                  {show("note") && (
                    <TableCell className="max-w-72 truncate" title={r.note ?? ""}>
                      {r.note?.split("\n")[0]}
                    </TableCell>
                  )}
                  {show("liableCode") && <TableCell>{r.liableCode}</TableCell>}
                  {show("liableName") && <TableCell>{r.liableName}</TableCell>}
                  {show("liableFine") && <TableCell className="text-right">{vnd(r.liableFineVnd)}</TableCell>}
                  {show("guard") && (
                    <TableCell className="py-1">
                      {(r.guardNameVi || r.guardCode) && (
                        <span className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-black" style={{ backgroundColor: r.guardColor ?? undefined }}>
                          <span className="tabular-nums">{r.guardCode}</span>
                          <span>{r.guardNameVi}</span>
                        </span>
                      )}
                    </TableCell>
                  )}
                  {show("reward") && <TableCell className="text-right">{vnd(r.guardRewardVnd)}</TableCell>}
                  {show("remark") && <TableCell className="text-muted-foreground">{r.remark}</TableCell>}
                  {canManage && (
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {canEdit && (
                          <Button type="button" size="icon" variant="ghost" className="size-7" disabled={adding || editingId !== null} aria-label={t("common.edit")} onClick={() => setEditingId(r.id)}>
                            <Pencil className="size-3.5" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button type="button" size="icon" variant="ghost" className="size-7 text-destructive" aria-label={t("common.delete")} onClick={() => setDeleteId(r.id)}>
                            <Trash2 className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              )
            )}

            {rows.length === 0 && !adding && (
              <TableRow>
                <TableCell colSpan={columnCount}>
                  <EmptyState message={t("sleep.empty")} />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        description={t("sleep.deleteConfirm")}
        confirmLabel={t("common.delete")}
        pending={deleting}
        onConfirm={() =>
          deleteId &&
          startDelete(async () => {
            await deleteSleepViolationAction(deleteId);
            setDeleteId(null);
            router.refresh();
          })
        }
      />
    </div>
  );
}

const cell = "p-1.5 align-middle";

/** A text box with a ▾ list of quick picks next to it — picking fills the box, typing anything
 *  else is still allowed. */
function PresetField({ value, onChange, options, className }: { value: string; onChange: (v: string) => void; options: PresetOption[]; className?: string }) {
  const t = useT();
  return (
    <div className={cn("flex h-8 items-center gap-0.5 rounded-lg border border-input bg-transparent pr-1 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30", className)}>
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-full min-w-0 flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent" />
      {options.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger aria-label={t("common.quickSelect")} className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground">
            <ChevronDown className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-80">
            {options.map((o) => (
              <DropdownMenuItem key={o.value} onClick={() => onChange(o.value)}>
                {o.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

function AmountField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <Input inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value)} onBlur={() => onChange(vnd(numberOrNull(value)))} className="min-w-24 text-right tabular-nums" />;
}

/** The one inline row used to add or edit — picking the employee by MSNV fills name, factory,
 *  department and position into their own columns; amounts and the penalty note are prefilled. */
function EditRow({
  stt,
  row,
  catalogs,
  show,
  onCancel,
  onSaved,
}: {
  stt: number;
  row: SleepRow | null;
  catalogs: SleepCatalogs;
  show: (id: SleepColumnId) => boolean;
  onCancel: () => void;
  onSaved: (year: number, month: number) => void;
}) {
  const t = useT();
  const d = catalogs.defaults;
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [checkDate, setCheckDate] = useState(row?.checkDate ?? todayIso());
  const [checkTime, setCheckTime] = useState(row?.checkTime ?? "");
  const [location, setLocation] = useState(row?.location ?? "");
  const [emp, setEmp] = useState({
    id: row?.employeeId ?? null,
    code: row?.employeeCode ?? "",
    name: row?.employeeName ?? "",
    factory: row?.factory ?? "",
    department: row?.department ?? "",
    position: row?.position ?? "",
  });
  const [fine, setFine] = useState(row ? vnd(row.fineAmountVnd) : vnd(d.fine));
  // A preset is re-filled with the row's own date on save; an existing note that matches no
  // preset is kept as-is ("custom").
  const matchedPreset = row?.note ? catalogs.notes.findIndex((p) => noteText(p, row.checkDate) === row.note) : 0;
  const [noteChoice, setNoteChoice] = useState(row && !row.note ? NO_NOTE : matchedPreset >= 0 ? String(matchedPreset) : CUSTOM_NOTE);
  const [liable, setLiable] = useState({ id: row?.liableEmployeeId ?? null, code: row?.liableCode ?? "", name: row?.liableName ?? "" });
  const [liableFine, setLiableFine] = useState(row ? vnd(row.liableFineVnd) : vnd(d.liable));
  const [guardId, setGuardId] = useState(row?.guardCatalogId ?? NO_GUARD);
  const [reward, setReward] = useState(row ? vnd(row.guardRewardVnd) : vnd(d.reward));
  const [remark, setRemark] = useState(row?.remark ?? "");

  const guard = catalogs.guards.find((g) => g.id === guardId) ?? null;

  async function pickEmployee(id: string | null) {
    if (!id) return setEmp((e) => ({ ...e, id: null }));
    const e = await getSleepEmployeeDetailsAction(id);
    if (e) setEmp({ id: e.id, code: e.employeeCode, name: e.name, factory: e.factory ?? "", department: e.department ?? "", position: e.position ?? "" });
  }

  async function pickLiable(id: string | null) {
    if (!id) return setLiable((l) => ({ ...l, id: null }));
    const e = await getSleepEmployeeDetailsAction(id);
    if (e) setLiable({ id: e.id, code: e.employeeCode, name: e.name });
  }

  function save() {
    if (!emp.name.trim()) {
      setError(t("sleep.errorEmployee"));
      return;
    }
    const preset = catalogs.notes[Number(noteChoice)];
    const note = noteChoice === CUSTOM_NOTE ? (row?.note ?? "") : noteChoice === NO_NOTE || !preset ? "" : noteText(preset, checkDate);
    setError(null);
    startTransition(async () => {
      const result = await saveSleepViolationAction({
        id: row?.id ?? null,
        checkDate,
        checkTime,
        location,
        employeeId: emp.id,
        employeeCode: emp.code,
        employeeName: emp.name,
        factory: emp.factory,
        department: emp.department,
        position: emp.position,
        fineAmountVnd: numberOrNull(fine),
        note,
        liableEmployeeId: liable.id,
        liableCode: liable.code,
        liableName: liable.name,
        liableFineVnd: numberOrNull(liableFine),
        guardCatalogId: guardId === NO_GUARD ? null : guardId,
        guardRewardVnd: numberOrNull(reward),
        remark,
      });
      if ("error" in result) setError(result.error);
      else onSaved(result.year, result.month);
    });
  }

  const auto = (v: string) => <span className="flex h-8 items-center text-muted-foreground">{v || "—"}</span>;
  const liableSpan = (show("liableCode") ? 1 : 0) + (show("liableName") ? 1 : 0);
  const noteLabel = (choice: string) =>
    choice === CUSTOM_NOTE ? (row?.note?.split("\n")[0] ?? "") : choice === NO_NOTE ? t("sleep.noteNone") : catalogs.notes[Number(choice)] ? fillNote(catalogs.notes[Number(choice)].vi, checkDate) : "";

  return (
    <>
      <TableRow className="bg-primary/[0.03] hover:bg-primary/[0.03]">
        <TableCell className={cn(cell, "text-muted-foreground")}>{stt}</TableCell>
        <TableCell className={cell}>
          <Input type="date" value={checkDate} onChange={(e) => setCheckDate(e.target.value)} className="w-36" aria-label={t("sleep.col.date")} />
        </TableCell>
        {show("time") && (
          <TableCell className={cell}>
            <Input value={checkTime} onChange={(e) => setCheckTime(e.target.value)} placeholder="4:20" maxLength={10} className="w-16" aria-label={t("sleep.col.time")} />
          </TableCell>
        )}
        {show("location") && (
          <TableCell className={cell}>
            <PresetField value={location} onChange={setLocation} options={catalogs.locations} className="w-44" />
          </TableCell>
        )}
        <TableCell className={cell} colSpan={2}>
          <EmployeeCombobox
            name="sleepEmployee"
            placeholder={t("sleep.pickEmployee")}
            emptyLabel={t("violationsLienDe.form.employeeEmpty")}
            defaultValue={row?.employeeId ? { id: row.employeeId, employeeCode: row.employeeCode ?? "", fullName: row.employeeName, fullNameZh: null } : null}
            onSelect={(e) => void pickEmployee(e?.id ?? null)}
            autoPickExactCode
            className="min-w-64"
          />
        </TableCell>
        {show("factory") && <TableCell className={cell}>{auto(emp.factory)}</TableCell>}
        {show("department") && <TableCell className={cell}>{auto(emp.department)}</TableCell>}
        {show("position") && <TableCell className={cell}>{auto(emp.position)}</TableCell>}
        <TableCell className={cell}>
          <AmountField value={fine} onChange={setFine} />
        </TableCell>
        {show("note") && (
          <TableCell className={cell}>
            <Select value={noteChoice} onValueChange={(v) => setNoteChoice(v ?? NO_NOTE)}>
              <SelectTrigger className="w-60">
                <SelectValue>{(v: string) => <span className="truncate">{noteLabel(v)}</span>}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {catalogs.notes.map((_, i) => (
                  <SelectItem key={i} value={String(i)}>
                    {noteLabel(String(i))}
                  </SelectItem>
                ))}
                {row?.note && matchedPreset < 0 && <SelectItem value={CUSTOM_NOTE}>{noteLabel(CUSTOM_NOTE)}</SelectItem>}
                <SelectItem value={NO_NOTE}>{t("sleep.noteNone")}</SelectItem>
              </SelectContent>
            </Select>
          </TableCell>
        )}
        {liableSpan > 0 && (
          <TableCell className={cell} colSpan={liableSpan}>
            <EmployeeCombobox
              name="sleepLiable"
              placeholder={t("sleep.pickLiable")}
              emptyLabel={t("violationsLienDe.form.employeeEmpty")}
              defaultValue={row?.liableEmployeeId ? { id: row.liableEmployeeId, employeeCode: row.liableCode ?? "", fullName: row.liableName ?? "", fullNameZh: null } : null}
              onSelect={(e) => void pickLiable(e?.id ?? null)}
              autoPickExactCode
              className="min-w-56"
            />
          </TableCell>
        )}
        {show("liableFine") && (
          <TableCell className={cell}>
            <AmountField value={liableFine} onChange={setLiableFine} />
          </TableCell>
        )}
        {show("guard") && (
          <TableCell className={cell}>
            <Select value={guardId} onValueChange={(v) => setGuardId(v ?? NO_GUARD)}>
              <SelectTrigger className="w-52">
                <SelectValue>
                  {() =>
                    guard ? (
                      <span className="flex items-center gap-2 truncate">
                        <span className="size-3 shrink-0 rounded-sm" style={{ backgroundColor: guard.color ?? undefined }} />
                        {guard.code} {guard.nameVi}
                      </span>
                    ) : (
                      t("sleep.guardNone")
                    )
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_GUARD}>{t("sleep.guardNone")}</SelectItem>
                {catalogs.guards.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    <span className="flex items-center gap-2">
                      <span className="size-3 shrink-0 rounded-sm" style={{ backgroundColor: g.color ?? undefined }} />
                      {g.code} {g.nameVi}
                      {g.nameZh && <span className="text-muted-foreground">{g.nameZh}</span>}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </TableCell>
        )}
        {show("reward") && (
          <TableCell className={cell}>
            <AmountField value={reward} onChange={setReward} />
          </TableCell>
        )}
        {show("remark") && (
          <TableCell className={cell}>
            <Input value={remark} onChange={(e) => setRemark(e.target.value)} maxLength={500} className="min-w-32" aria-label={t("sleep.col.remark")} />
          </TableCell>
        )}
        <TableCell className={cell}>
          <div className="flex items-center gap-1">
            <Button type="button" size="icon" variant="ghost" className="size-7 text-primary" disabled={pending} aria-label={t("common.save")} onClick={save}>
              <Check className="size-3.5" />
            </Button>
            <Button type="button" size="icon" variant="ghost" className="size-7" disabled={pending} aria-label={t("common.cancel")} onClick={onCancel}>
              <X className="size-3.5" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
      {error && (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={99} className="py-1.5 text-sm text-destructive">
            {error}
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
