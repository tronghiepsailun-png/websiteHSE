"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Moon, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { EmployeeCombobox } from "@/components/employees/employee-combobox";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/locale-context";
import { deleteSleepViolationAction, getSleepEmployeeDetailsAction, saveSleepViolationAction } from "./actions";

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
  factories: PresetOption[];
  departments: PresetOption[];
  positions: PresetOption[];
  notes: NotePreset[];
  guards: GuardOption[];
  defaults: { fine: number; liable: number; reward: number };
};

const NO_GUARD = "__none__";

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

function todayIso() {
  const now = new Date(Date.now() + 7 * 3_600_000);
  return now.toISOString().slice(0, 10);
}

export function SleepView({
  rows,
  catalogs,
  canEdit,
  canDelete,
}: {
  rows: SleepRow[];
  catalogs: SleepCatalogs;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [editing, setEditing] = useState<SleepRow | "new" | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, startDelete] = useTransition();
  const canManage = canEdit || canDelete;

  const head = (vi: string, zh: string, className?: string) => (
    <TableHead className={cn("h-auto min-w-20 py-2 text-center leading-tight whitespace-normal", className)}>
      <span className="block">{vi}</span>
      <span className="block font-normal">{zh}</span>
    </TableHead>
  );

  return (
    <div className="flex flex-col gap-3">
      {canEdit && (
        <div className="flex justify-end">
          <Button type="button" size="sm" onClick={() => setEditing("new")}>
            <Plus className="size-4" />
            {t("sleep.add")}
          </Button>
        </div>
      )}

      <Card className="py-0">
        <Table className="text-xs">
          <TableHeader>
            <TableRow>
              {head("STT", "序号", "w-10 min-w-10")}
              {head("Ngày kiểm tra", "检查日期")}
              {head("Giờ", "违纪时间", "min-w-14")}
              {head("Địa điểm", "违纪地点", "min-w-32")}
              {head("MST vi phạm", "违规人员工号")}
              {head("Nhà xưởng", "工厂")}
              {head("Bộ phận", "部门")}
              {head("Vị trí", "岗位")}
              {head("Tên NV vi phạm", "违规人员名称", "min-w-36")}
              {head("Khảo hạch", "考核金额")}
              {head("Ghi chú", "备注", "min-w-80")}
              {head("MST liên đới", "连带责任人工号")}
              {head("Người liên đới", "连带责任人名称", "min-w-32")}
              {head("Khảo hạch", "考核金额")}
              {head("MST bảo an", "检查保安的工号")}
              {head("Bảo an kiểm tra", "检查保安的姓名", "min-w-36")}
              {head("Thưởng bảo an", "保安奖金")}
              {head("Ghi chú", "备注", "min-w-28")}
              {canManage && <TableHead className="w-16" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={r.id}>
                <TableCell className="text-center text-muted-foreground">{i + 1}</TableCell>
                <TableCell className="text-center">{formatDate(r.checkDate)}</TableCell>
                <TableCell className="text-center">{r.checkTime}</TableCell>
                <TableCell className="text-center whitespace-normal">{r.location}</TableCell>
                <TableCell className="text-center">{r.employeeCode}</TableCell>
                <TableCell className="text-center">{r.factory}</TableCell>
                <TableCell className="text-center">{r.department}</TableCell>
                <TableCell className="text-center">{r.position}</TableCell>
                <TableCell className="text-center font-medium">{r.employeeName}</TableCell>
                <TableCell className="text-right">{vnd(r.fineAmountVnd)}</TableCell>
                <TableCell className="whitespace-pre-line">{r.note}</TableCell>
                <TableCell className="text-center">{r.liableCode}</TableCell>
                <TableCell>{r.liableName}</TableCell>
                <TableCell className="text-right">{vnd(r.liableFineVnd)}</TableCell>
                <TableCell className="text-center">{r.guardCode}</TableCell>
                <TableCell className="p-1 text-center">
                  {(r.guardNameVi || r.guardNameZh) && (
                    <span className="block rounded px-2 py-1 leading-tight text-black" style={{ backgroundColor: r.guardColor ?? undefined }}>
                      <span className="block">{r.guardNameZh}</span>
                      <span className="block">{r.guardNameVi}</span>
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right">{vnd(r.guardRewardVnd)}</TableCell>
                <TableCell className="whitespace-normal">{r.remark}</TableCell>
                {canManage && (
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {canEdit && (
                        <Button type="button" size="icon" variant="ghost" className="size-7" aria-label={t("common.edit")} onClick={() => setEditing(r)}>
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
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={18 + (canManage ? 1 : 0)}>
                  <EmptyState message={t("sleep.empty")} />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {editing !== null && (
        <SleepFormDialog
          key={editing === "new" ? "new" : editing.id}
          row={editing === "new" ? null : editing}
          catalogs={catalogs}
          onClose={() => setEditing(null)}
          onSaved={(year, month, current) => {
            setEditing(null);
            if (!current) router.push(`/violations/sleep?ym=${year}-${month}`);
            else router.refresh();
          }}
        />
      )}

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

/** A text box with a ▾ list of quick picks next to it — picking fills the box, typing anything
 *  else is still allowed. */
function PresetField({
  id,
  value,
  onChange,
  options,
  placeholder,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  options: PresetOption[];
  placeholder?: string;
}) {
  const t = useT();
  return (
    <div className="flex h-8 items-center gap-0.5 rounded-lg border border-input bg-transparent pr-1 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30">
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-full min-w-0 flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
      />
      {options.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={t("common.quickSelect")}
            className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground"
          >
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

function Field({ label, htmlFor, children, className }: { label: string; htmlFor?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid grid-cols-1 gap-3 rounded-lg border p-3 sm:grid-cols-2">
      <legend className="px-1 text-sm font-semibold">{title}</legend>
      {children}
    </fieldset>
  );
}

function numberOrNull(v: string) {
  const n = Number(v.replace(/[^\d]/g, ""));
  return v.trim() === "" || Number.isNaN(n) ? null : n;
}

function SleepFormDialog({
  row,
  catalogs,
  onClose,
  onSaved,
}: {
  row: SleepRow | null;
  catalogs: SleepCatalogs;
  onClose: () => void;
  onSaved: (year: number, month: number, sameMonth: boolean) => void;
}) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const d = catalogs.defaults;

  const [checkDate, setCheckDate] = useState(row?.checkDate ?? todayIso());
  const [checkTime, setCheckTime] = useState(row?.checkTime ?? "");
  const [location, setLocation] = useState(row?.location ?? "");
  const [employeeId, setEmployeeId] = useState(row?.employeeId ?? null);
  const [employeeCode, setEmployeeCode] = useState(row?.employeeCode ?? "");
  const [employeeName, setEmployeeName] = useState(row?.employeeName ?? "");
  const [factory, setFactory] = useState(row?.factory ?? "");
  const [department, setDepartment] = useState(row?.department ?? "");
  const [position, setPosition] = useState(row?.position ?? "");
  const [fine, setFine] = useState(row ? vnd(row.fineAmountVnd) : vnd(d.fine));
  const [note, setNote] = useState(row?.note ?? (catalogs.notes[0] ? noteText(catalogs.notes[0], row?.checkDate ?? todayIso()) : ""));
  // Which preset the note text came from — while set, changing the check date rewrites the
  // note's month/date to match; typing into the note by hand detaches it.
  const [notePreset, setNotePreset] = useState<number | null>(row || !catalogs.notes[0] ? null : 0);

  function changeCheckDate(iso: string) {
    setCheckDate(iso);
    if (notePreset !== null && catalogs.notes[notePreset] && iso) setNote(noteText(catalogs.notes[notePreset], iso));
  }
  const [liableEmployeeId, setLiableEmployeeId] = useState(row?.liableEmployeeId ?? null);
  const [liableCode, setLiableCode] = useState(row?.liableCode ?? "");
  const [liableName, setLiableName] = useState(row?.liableName ?? "");
  const [liableFine, setLiableFine] = useState(row ? vnd(row.liableFineVnd) : vnd(d.liable));
  const [guardId, setGuardId] = useState(row?.guardCatalogId ?? NO_GUARD);
  const [reward, setReward] = useState(row ? vnd(row.guardRewardVnd) : vnd(d.reward));
  const [remark, setRemark] = useState(row?.remark ?? "");

  function noteText(p: NotePreset, iso: string) {
    return [fillNote(p.vi, iso), p.zh].filter(Boolean).join("\n");
  }

  const guard = catalogs.guards.find((g) => g.id === guardId) ?? null;
  const guardLabel = (g: GuardOption) => `${g.code ? `${g.code} — ` : ""}${g.nameVi}${g.nameZh ? ` (${g.nameZh})` : ""}`;

  async function pickEmployee(id: string | null) {
    setEmployeeId(id);
    if (!id) return;
    const e = await getSleepEmployeeDetailsAction(id);
    if (!e) return;
    setEmployeeCode(e.employeeCode);
    setEmployeeName(e.name);
    if (e.factory) setFactory(e.factory);
    if (e.department) setDepartment(e.department);
    if (e.position) setPosition(e.position);
  }

  async function pickLiable(id: string | null) {
    setLiableEmployeeId(id);
    if (!id) return;
    const e = await getSleepEmployeeDetailsAction(id);
    if (!e) return;
    setLiableCode(e.employeeCode);
    setLiableName(e.name);
  }

  function save() {
    if (!employeeName.trim()) {
      setError(t("sleep.errorEmployee"));
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await saveSleepViolationAction({
        id: row?.id ?? null,
        checkDate,
        checkTime,
        location,
        employeeId,
        employeeCode,
        employeeName,
        factory,
        department,
        position,
        fineAmountVnd: numberOrNull(fine),
        note,
        liableEmployeeId,
        liableCode,
        liableName,
        liableFineVnd: numberOrNull(liableFine),
        guardCatalogId: guardId === NO_GUARD ? null : guardId,
        guardRewardVnd: numberOrNull(reward),
        remark,
      });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      const [y, m] = (row?.checkDate ?? "").split("-").map(Number);
      onSaved(result.year, result.month, row ? y === result.year && m === result.month : false);
    });
  }

  const amountInput = (id: string, value: string, set: (v: string) => void) => (
    <Input id={id} inputMode="numeric" value={value} onChange={(e) => set(e.target.value)} onBlur={() => set(vnd(numberOrNull(value)))} className="text-right tabular-nums" />
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Moon className="size-4.5 text-blue-500" />
            {row ? t("sleep.editTitle") : t("sleep.addTitle")}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <Section title={t("sleep.section.check")}>
            <Field label={t("sleep.field.checkDate")} htmlFor="sv-date">
              <Input id="sv-date" type="date" value={checkDate} onChange={(e) => changeCheckDate(e.target.value)} required />
            </Field>
            <Field label={t("sleep.field.checkTime")} htmlFor="sv-time">
              <Input id="sv-time" value={checkTime} onChange={(e) => setCheckTime(e.target.value)} placeholder="4:20" maxLength={10} />
            </Field>
            <Field label={t("sleep.field.location")} htmlFor="sv-location" className="sm:col-span-2">
              <PresetField id="sv-location" value={location} onChange={setLocation} options={catalogs.locations} />
            </Field>
          </Section>

          <Section title={t("sleep.section.employee")}>
            <Field label={t("sleep.field.pickEmployee")} className="sm:col-span-2">
              <EmployeeCombobox
                name="sleepEmployee"
                placeholder={t("violationsLienDe.form.employeePlaceholder")}
                emptyLabel={t("violationsLienDe.form.employeeEmpty")}
                defaultValue={row?.employeeId ? { id: row.employeeId, employeeCode: row.employeeCode ?? "", fullName: row.employeeName, fullNameZh: null } : null}
                onSelect={(e) => void pickEmployee(e?.id ?? null)}
              />
            </Field>
            <Field label={t("sleep.field.employeeCode")} htmlFor="sv-code">
              <Input id="sv-code" value={employeeCode} onChange={(e) => setEmployeeCode(e.target.value)} />
            </Field>
            <Field label={t("sleep.field.employeeName")} htmlFor="sv-name">
              <Input id="sv-name" value={employeeName} onChange={(e) => setEmployeeName(e.target.value)} required />
            </Field>
            <Field label={t("sleep.field.factory")} htmlFor="sv-factory">
              <PresetField id="sv-factory" value={factory} onChange={setFactory} options={catalogs.factories} />
            </Field>
            <Field label={t("sleep.field.department")} htmlFor="sv-dept">
              <PresetField id="sv-dept" value={department} onChange={setDepartment} options={catalogs.departments} />
            </Field>
            <Field label={t("sleep.field.position")} htmlFor="sv-position">
              <PresetField id="sv-position" value={position} onChange={setPosition} options={catalogs.positions} />
            </Field>
            <Field label={t("sleep.field.fine")} htmlFor="sv-fine">
              {amountInput("sv-fine", fine, setFine)}
            </Field>
            <Field label={t("sleep.field.note")} htmlFor="sv-note" className="sm:col-span-2">
              <Textarea
                id="sv-note"
                value={note}
                onChange={(e) => {
                  setNote(e.target.value);
                  setNotePreset(null);
                }}
                rows={2}
              />
              {catalogs.notes.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {catalogs.notes.map((p, i) => (
                    <Button
                      key={i}
                      type="button"
                      variant={notePreset === i ? "secondary" : "outline"}
                      size="xs"
                      onClick={() => {
                        setNote(noteText(p, checkDate));
                        setNotePreset(i);
                      }}
                    >
                      {fillNote(p.vi, checkDate)}
                    </Button>
                  ))}
                </div>
              )}
            </Field>
          </Section>

          <Section title={t("sleep.section.liable")}>
            <Field label={t("sleep.field.pickLiable")} className="sm:col-span-2">
              <EmployeeCombobox
                name="sleepLiable"
                placeholder={t("violationsLienDe.form.employeePlaceholder")}
                emptyLabel={t("violationsLienDe.form.employeeEmpty")}
                defaultValue={row?.liableEmployeeId ? { id: row.liableEmployeeId, employeeCode: row.liableCode ?? "", fullName: row.liableName ?? "", fullNameZh: null } : null}
                onSelect={(e) => void pickLiable(e?.id ?? null)}
              />
            </Field>
            <Field label={t("sleep.field.liableCode")} htmlFor="sv-lcode">
              <Input id="sv-lcode" value={liableCode} onChange={(e) => setLiableCode(e.target.value)} />
            </Field>
            <Field label={t("sleep.field.liableName")} htmlFor="sv-lname">
              <Input id="sv-lname" value={liableName} onChange={(e) => setLiableName(e.target.value)} />
            </Field>
            <Field label={t("sleep.field.liableFine")} htmlFor="sv-lfine">
              {amountInput("sv-lfine", liableFine, setLiableFine)}
            </Field>
          </Section>

          <Section title={t("sleep.section.guard")}>
            <Field label={t("sleep.field.guard")}>
              <Select value={guardId} onValueChange={(v) => setGuardId(v ?? NO_GUARD)}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {() =>
                      guard ? (
                        <span className="flex items-center gap-2">
                          <span className="size-3 shrink-0 rounded-sm" style={{ backgroundColor: guard.color ?? undefined }} />
                          {guardLabel(guard)}
                        </span>
                      ) : (
                        t("sleep.field.guardNone")
                      )
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_GUARD}>{t("sleep.field.guardNone")}</SelectItem>
                  {catalogs.guards.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      <span className="flex items-center gap-2">
                        <span className="size-3 shrink-0 rounded-sm" style={{ backgroundColor: g.color ?? undefined }} />
                        {guardLabel(g)}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t("sleep.field.reward")} htmlFor="sv-reward">
              {amountInput("sv-reward", reward, setReward)}
            </Field>
            <Field label={t("sleep.field.remark")} htmlFor="sv-remark" className="sm:col-span-2">
              <Input id="sv-remark" value={remark} onChange={(e) => setRemark(e.target.value)} maxLength={500} />
            </Field>
          </Section>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="button" onClick={save} disabled={pending}>
            {pending ? t("common.saving") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
