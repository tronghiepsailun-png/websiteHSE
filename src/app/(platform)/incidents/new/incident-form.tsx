"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createIncidentAction, previewIncidentNumberAction, type CreateIncidentState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { FieldError } from "@/components/ui/field-error";
import { IncidentStatusBadge } from "@/components/incidents/severity-badge";
import { EmployeeCombobox } from "@/components/employees/employee-combobox";
import { useT } from "@/lib/i18n/locale-context";
import { DEFAULT_POINTS_DEDUCTED_BY_SEVERITY, deriveFactoryCode } from "@/lib/incident-constants";

type Option = { id: string; name: string };
type SeverityOption = Option & { code: string };

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{children}</p>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export function IncidentForm({
  orgUnits,
  categories,
  severities,
}: {
  orgUnits: Option[];
  categories: Option[];
  severities: SeverityOption[];
}) {
  const [state, formAction, pending] = useActionState<CreateIncidentState, FormData>(createIncidentAction, undefined);
  const t = useT();
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  const nowLocal = now.toISOString().slice(0, 16);

  // Points deducted is a fixed function of severity, not a freely chosen number (see
  // DEFAULT_POINTS_DEDUCTED_BY_SEVERITY) — picking a severity jumps this straight to its fixed
  // value so the reporter never has to know/look up the convention; still a plain editable
  // input afterward for the rare case that needs a manual override.
  const [pointsDeducted, setPointsDeducted] = useState("");
  function handleSeverityChange(severityId: string) {
    const severity = severities.find((s) => s.id === severityId);
    const fixedPoints = severity ? DEFAULT_POINTS_DEDUCTED_BY_SEVERITY[severity.code] : undefined;
    setPointsDeducted(fixedPoints !== undefined ? String(fixedPoints) : "");
  }

  // "Số hiệu sự cố" is a fixed function of "Ngày xảy ra" (CCG's own CCG/AT{ngày}-{stt trong
  // ngày} convention, see generateIncidentNumber) — never freely typed. A live server preview
  // follows every date change (debounced) so the reporter sees the real number ahead of time
  // without needing to know the convention; createIncidentAction recomputes it independently
  // at submit time regardless of what this preview showed.
  const [occurredAt, setOccurredAt] = useState(nowLocal);
  const [incidentNumber, setIncidentNumber] = useState("");
  const previewDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current);
    previewDebounceRef.current = setTimeout(async () => {
      const preview = await previewIncidentNumberAction(occurredAt);
      setIncidentNumber(preview ?? "");
    }, 300);
    return () => {
      if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current);
    };
  }, [occurredAt]);

  // "Mã nhà máy" is a fixed function of the department's own name (一期→31, 二期→41, 三期→1102,
  // see deriveFactoryCode) — picking a department with one of those phase markers locks this to
  // the fixed code; a department with no phase marker in its name has no fixed convention, so
  // the field unlocks for manual entry instead.
  const [factoryCode, setFactoryCode] = useState("");
  const [factoryCodeLocked, setFactoryCodeLocked] = useState(false);
  function handleOrgUnitChange(orgUnitId: string) {
    const orgUnit = orgUnits.find((u) => u.id === orgUnitId);
    const derived = deriveFactoryCode(orgUnit?.name);
    setFactoryCode(derived ?? "");
    setFactoryCodeLocked(derived !== null);
  }

  return (
    <form action={formAction} className="flex flex-col gap-2">
      {/* Condensed key-facts strip — Ngày xảy ra comes first since Số hiệu sự cố is derived
          from it (CCG/AT{ngày}-{stt}), not the other way around. */}
      <Card size="sm">
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label={t("incidents.table.occurred")}>
            <Input
              id="occurredAt"
              name="occurredAt"
              type="datetime-local"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
              required
              aria-invalid={!!state?.fieldErrors?.occurredAt}
            />
            <FieldError kind={state?.fieldErrors?.occurredAt} />
          </Field>
          <Field label={t("incidents.new.fields.incidentNumber")}>
            <Input
              value={incidentNumber}
              readOnly
              placeholder={t("incidents.new.fields.incidentNumberPlaceholder")}
              className="bg-muted text-muted-foreground"
            />
          </Field>
          <Field label={t("incidents.table.severity")}>
            <Select name="severityId" onValueChange={(v) => handleSeverityChange(v as string)} required>
              <SelectTrigger aria-invalid={!!state?.fieldErrors?.severityId} className="w-full">
                <SelectValue placeholder={t("incidents.new.selectSeverityPlaceholder")}>
                  {(value: string) => severities.find((s) => s.id === value)?.name ?? value}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {severities.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <FieldError kind={state?.fieldErrors?.severityId} />
          </Field>
          <Field label={t("incidents.new.fields.locationDetail")}>
            <Input id="locationDetail" name="locationDetail" placeholder={t("incidents.new.fields.locationDetailPlaceholder")} />
          </Field>
        </CardContent>
      </Card>

      {/* Two-column body — mirrors the detail page's 2:1 grid, section-for-section */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left: description, people & general info, corrective action, status */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card size="sm">
            <CardContent>
              <SectionLabel>{t("incidents.detail.description")}</SectionLabel>
              <Textarea id="description" name="description" required rows={3} aria-invalid={!!state?.fieldErrors?.description} />
              <FieldError kind={state?.fieldErrors?.description} />
            </CardContent>
          </Card>

          <Card size="sm">
            <CardContent className="flex flex-col gap-3">
              <SectionLabel>{t("incidents.detail.peopleAndInfo")}</SectionLabel>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field label={t("incidents.table.category")}>
                  <Select name="categoryId" required>
                    <SelectTrigger aria-invalid={!!state?.fieldErrors?.categoryId} className="w-full">
                      <SelectValue placeholder={t("incidents.new.selectCategoryPlaceholder")}>
                        {(value: string) => categories.find((c) => c.id === value)?.name ?? value}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FieldError kind={state?.fieldErrors?.categoryId} />
                </Field>
                <Field label={t("incidents.new.fields.orgUnit")}>
                  <Select name="orgUnitId" onValueChange={(v) => handleOrgUnitChange(v as string)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t("incidents.new.selectLocationPlaceholder")}>
                        {(value: string) => orgUnits.find((u) => u.id === value)?.name ?? value}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {orgUnits.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label={t("incidents.new.fields.factoryCode")}>
                  <Input
                    id="factoryCode"
                    name="factoryCode"
                    value={factoryCode}
                    onChange={(e) => setFactoryCode(e.target.value)}
                    readOnly={factoryCodeLocked}
                    placeholder={t("incidents.new.fields.factoryCodePlaceholder")}
                    className={factoryCodeLocked ? "bg-muted text-muted-foreground" : undefined}
                  />
                </Field>
                <Field label={t("incidents.new.fields.equipment")}>
                  <Input id="equipment" name="equipment" placeholder={t("incidents.new.fields.equipmentPlaceholder")} />
                </Field>
                <Field label={t("incidents.detail.costVnd")}>
                  <Input id="costVnd" name="costVnd" type="number" step="0.01" min="0" />
                </Field>
                <Field label={t("incidents.detail.costRmb")}>
                  <Input id="costRmb" name="costRmb" type="number" step="0.01" min="0" />
                </Field>
                <Field label={t("incidents.detail.pointsDeducted")}>
                  <Input
                    id="pointsDeducted"
                    name="pointsDeducted"
                    type="number"
                    step="0.1"
                    value={pointsDeducted}
                    readOnly
                    className="bg-muted text-muted-foreground"
                  />
                </Field>
                <Field label={t("incidents.detail.injuredBodyPart")}>
                  <Input id="injuredBodyPart" name="injuredBodyPart" />
                </Field>
              </div>
              <div className="grid grid-cols-1 gap-3 border-t pt-3 sm:grid-cols-3">
                <Field label={t("incidents.new.fields.employee")}>
                  <EmployeeCombobox
                    name="employeeId"
                    placeholder={t("incidents.new.selectEmployeePlaceholder")}
                    emptyLabel={t("incidents.new.noEmployeeMatch")}
                  />
                </Field>
                <Field label={t("incidents.detail.responsiblePerson")}>
                  <EmployeeCombobox
                    name="responsiblePersonId"
                    placeholder={t("common.unassigned")}
                    emptyLabel={t("incidents.new.noEmployeeMatch")}
                  />
                </Field>
              </div>
            </CardContent>
          </Card>

          <Card size="sm">
            <CardContent>
              <SectionLabel>{t("incidents.new.fields.correctiveAction")}</SectionLabel>
              <Textarea id="correctiveAction" name="correctiveAction" rows={2} />
            </CardContent>
          </Card>

          <Card size="sm">
            <CardContent>
              <SectionLabel>{t("common.status")}</SectionLabel>
              <IncidentStatusBadge status="investigating" />
            </CardContent>
          </Card>
        </div>

        {/* Right: photos — same slot as the detail page's photo card, but upload only becomes
            possible once the incident record exists, so this is informational only here. */}
        <Card size="sm" className="flex h-full flex-col">
          <CardContent>
            <SectionLabel>{t("incidents.detail.photos")}</SectionLabel>
            <p className="text-sm text-muted-foreground">{t("incidents.new.photosAfterSave")}</p>
          </CardContent>
        </Card>
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? t("common.saving") : t("incidents.reportButton")}
        </Button>
      </div>
    </form>
  );
}
