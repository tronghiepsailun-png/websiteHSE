"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { updateIncidentFullAction, type UpdateIncidentFullState } from "./actions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmployeeCombobox } from "@/components/employees/employee-combobox";
import { useT } from "@/lib/i18n/locale-context";
import type { DictionaryKey } from "@/lib/i18n/translate";
import type { EmployeeLite } from "@/server/employees";
import { DEFAULT_POINTS_DEDUCTED_BY_SEVERITY, deriveFactoryCode } from "@/lib/incident-constants";

type Option = { id: string; name: string };
type SeverityOption = Option & { code: string };

type IncidentDetail = {
  id: string;
  updatedAt: Date;
  occurredAt: Date;
  orgUnitId: string | null;
  locationDetail: string | null;
  equipment: string | null;
  employee: EmployeeLite | null;
  responsiblePerson: EmployeeLite | null;
  categoryId: string;
  severityId: string;
  description: string;
  correctiveAction: string | null;
  costVnd: number | null;
  cost: number | null;
  costRmb: number | null;
  pointsDeducted: number | null;
  injuredBodyPart: string | null;
  notes: string | null;
  status: string;
};

function toDateTimeLocal(d: Date | null) {
  if (!d) return "";
  const local = new Date(d);
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
  return local.toISOString().slice(0, 16);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export function EditIncidentDialog({
  incident,
  initialFactoryCode,
  orgUnits,
  categories,
  severities,
}: {
  incident: IncidentDetail;
  /** getIncidentFactoryCode()'s result for this incident — "—" (its "nothing found" marker)
   *  means no factory code, not a literal value to preserve. */
  initialFactoryCode: string;
  orgUnits: Option[];
  categories: Option[];
  severities: SeverityOption[];
}) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<UpdateIncidentFullState, FormData>(updateIncidentFullAction, undefined);

  // Points deducted is a fixed function of severity (see DEFAULT_POINTS_DEDUCTED_BY_SEVERITY),
  // never a freely typed number — the field is read-only and always mirrors whichever severity
  // is currently selected, recomputed (not just read from the stored value) so reopening this
  // dialog also self-corrects a record whose stored points had drifted from its severity.
  function fixedPointsFor(severityId: string): string {
    const severity = severities.find((s) => s.id === severityId);
    const fixedPoints = severity ? DEFAULT_POINTS_DEDUCTED_BY_SEVERITY[severity.code] : undefined;
    return fixedPoints !== undefined ? String(fixedPoints) : "";
  }
  const [pointsDeducted, setPointsDeducted] = useState(() => fixedPointsFor(incident.severityId));
  useEffect(() => {
    setPointsDeducted(fixedPointsFor(incident.severityId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incident.id, incident.updatedAt, incident.severityId]);

  // "Mã nhà máy" is a fixed function of the department's own name (一期→31, 二期→41, 三期→1102,
  // see deriveFactoryCode) — a department with one of those phase markers locks this field to
  // the fixed code (recomputed on reopen, same self-healing reasoning as pointsDeducted above);
  // a department with no phase marker has no fixed convention, so it falls back to whatever was
  // already stored and stays freely editable.
  function factoryCodeFor(orgUnitId: string | null, existingValue: string): { value: string; locked: boolean } {
    const orgUnit = orgUnits.find((u) => u.id === orgUnitId);
    const derived = deriveFactoryCode(orgUnit?.name);
    return derived !== null ? { value: derived, locked: true } : { value: existingValue, locked: false };
  }
  const initialFactoryCodeValue = initialFactoryCode === "—" ? "" : initialFactoryCode;
  const [factoryCode, setFactoryCode] = useState(() => factoryCodeFor(incident.orgUnitId, initialFactoryCodeValue).value);
  const [factoryCodeLocked, setFactoryCodeLocked] = useState(() => factoryCodeFor(incident.orgUnitId, initialFactoryCodeValue).locked);
  useEffect(() => {
    const result = factoryCodeFor(incident.orgUnitId, initialFactoryCodeValue);
    setFactoryCode(result.value);
    setFactoryCodeLocked(result.locked);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incident.id, incident.updatedAt, incident.orgUnitId, initialFactoryCodeValue]);
  function handleOrgUnitChange(orgUnitId: string) {
    const result = factoryCodeFor(orgUnitId, "");
    setFactoryCode(result.value);
    setFactoryCodeLocked(result.locked);
  }

  useEffect(() => {
    if (state && "success" in state) {
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" className="gap-1" />}>
        <Pencil className="h-3.5 w-3.5" />
        {t("common.edit")}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("incidents.detail.editIncident")}</DialogTitle>
        </DialogHeader>
        <form key={`${incident.id}-${incident.updatedAt.getTime()}`} action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="incidentId" value={incident.id} />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label={t("incidents.table.severity")}>
              <Select name="severityId" defaultValue={incident.severityId} onValueChange={(v) => setPointsDeducted(fixedPointsFor(v as string))}>
                <SelectTrigger className="w-full">
                  <SelectValue>{(value: string) => severities.find((s) => s.id === value)?.name ?? value}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {severities.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t("incidents.table.occurred")}>
              <Input name="occurredAt" type="datetime-local" defaultValue={toDateTimeLocal(incident.occurredAt)} required />
            </Field>
            <Field label={t("incidents.new.fields.locationDetail")}>
              <Input name="locationDetail" defaultValue={incident.locationDetail ?? ""} />
            </Field>
          </div>

          <Field label={t("incidents.detail.description")}>
            <Textarea name="description" required rows={3} defaultValue={incident.description} />
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label={t("incidents.table.category")}>
              <Select name="categoryId" defaultValue={incident.categoryId}>
                <SelectTrigger className="w-full">
                  <SelectValue>{(value: string) => categories.find((c) => c.id === value)?.name ?? value}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t("incidents.new.fields.orgUnit")}>
              <Select name="orgUnitId" defaultValue={incident.orgUnitId ?? undefined} onValueChange={(v) => handleOrgUnitChange(v as string)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("incidents.new.selectLocationPlaceholder")}>
                    {(value: string) => orgUnits.find((u) => u.id === value)?.name ?? value}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {orgUnits.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t("incidents.new.fields.factoryCode")}>
              <Input
                name="factoryCode"
                value={factoryCode}
                onChange={(e) => setFactoryCode(e.target.value)}
                readOnly={factoryCodeLocked}
                placeholder={t("incidents.new.fields.factoryCodePlaceholder")}
                className={factoryCodeLocked ? "bg-muted text-muted-foreground" : undefined}
              />
            </Field>
            <Field label={t("incidents.new.fields.equipment")}>
              <Input name="equipment" defaultValue={incident.equipment ?? ""} />
            </Field>
            <Field label={t("incidents.detail.costVnd")}>
              <Input name="costVnd" type="number" step="0.01" min="0" defaultValue={incident.costVnd ?? incident.cost ?? ""} />
            </Field>
            <Field label={t("incidents.detail.costRmb")}>
              <Input name="costRmb" type="number" step="0.01" min="0" defaultValue={incident.costRmb ?? ""} />
            </Field>
            <Field label={t("incidents.detail.pointsDeducted")}>
              <Input name="pointsDeducted" type="number" step="0.1" value={pointsDeducted} readOnly className="bg-muted text-muted-foreground" />
            </Field>
            <Field label={t("incidents.detail.injuredBodyPart")}>
              <Input name="injuredBodyPart" defaultValue={incident.injuredBodyPart ?? ""} />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t("incidents.new.fields.employee")}>
              <EmployeeCombobox
                name="employeeId"
                placeholder={t("incidents.new.selectEmployeePlaceholder")}
                emptyLabel={t("incidents.new.noEmployeeMatch")}
                defaultValue={incident.employee}
              />
            </Field>
            <Field label={t("incidents.detail.responsiblePerson")}>
              <EmployeeCombobox
                name="responsiblePersonId"
                placeholder={t("common.unassigned")}
                emptyLabel={t("incidents.new.noEmployeeMatch")}
                defaultValue={incident.responsiblePerson}
              />
            </Field>
          </div>

          <Field label={t("incidents.new.fields.correctiveAction")}>
            <Textarea name="correctiveAction" rows={2} defaultValue={incident.correctiveAction ?? ""} />
          </Field>
          <Field label={t("incidents.detail.notes")}>
            <Textarea name="notes" rows={3} defaultValue={incident.notes ?? ""} />
          </Field>

          <div className="sm:w-1/3">
            <Field label={t("common.status")}>
              <Select name="status" defaultValue={incident.status}>
                <SelectTrigger className="w-full">
                  <SelectValue>{(value: string) => t(`status.incident.${value}` as DictionaryKey)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="investigating">{t("status.incident.investigating")}</SelectItem>
                  <SelectItem value="closed">{t("status.incident.closed")}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          {state && "error" in state && <p className="text-sm text-destructive">{state.error}</p>}

          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>
              {pending ? t("common.saving") : t("common.saveChanges")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
