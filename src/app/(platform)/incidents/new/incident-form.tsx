"use client";

import { useActionState } from "react";
import { createIncidentAction, type CreateIncidentState } from "./actions";
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

type Option = { id: string; name: string };

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
  severities: Option[];
}) {
  const [state, formAction, pending] = useActionState<CreateIncidentState, FormData>(createIncidentAction, undefined);
  const t = useT();
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  const nowLocal = now.toISOString().slice(0, 16);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      {/* Optional custom number — sits inline like the detail page's page-title incident number,
          not as its own section, since it has no card counterpart on the detail page. */}
      <div className="flex flex-col gap-1.5 sm:max-w-xs">
        <Label htmlFor="incidentNumber">{t("incidents.new.fields.incidentNumber")}</Label>
        <Input id="incidentNumber" name="incidentNumber" placeholder={t("incidents.new.fields.incidentNumberPlaceholder")} />
      </div>

      {/* Condensed key-facts strip — mirrors the detail page's Mức độ/Ngày xảy ra/Vị trí strip */}
      <Card size="sm">
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label={t("incidents.table.severity")}>
            <Select name="severityId" required>
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
          <Field label={t("incidents.table.occurred")}>
            <Input
              id="occurredAt"
              name="occurredAt"
              type="datetime-local"
              defaultValue={nowLocal}
              required
              aria-invalid={!!state?.fieldErrors?.occurredAt}
            />
            <FieldError kind={state?.fieldErrors?.occurredAt} />
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
                  <Select name="orgUnitId">
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
                  <Input id="pointsDeducted" name="pointsDeducted" type="number" step="0.1" />
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
