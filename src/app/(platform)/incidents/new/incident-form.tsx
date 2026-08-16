"use client";

import { useActionState } from "react";
import { createIncidentAction, type CreateIncidentState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldError } from "@/components/ui/field-error";
import { useT } from "@/lib/i18n/locale-context";

type Option = { id: string; name: string };

export function IncidentForm({
  orgUnits,
  categories,
  severities,
  employees,
}: {
  orgUnits: Option[];
  categories: Option[];
  severities: Option[];
  employees: Option[];
}) {
  const [state, formAction, pending] = useActionState<CreateIncidentState, FormData>(createIncidentAction, undefined);
  const t = useT();
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  const nowLocal = now.toISOString().slice(0, 16);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <Card>
        <CardHeader><CardTitle className="text-base font-semibold">{t("incidents.new.sections.identification")}</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="incidentNumber">{t("incidents.new.fields.incidentNumber")}</Label>
            <Input id="incidentNumber" name="incidentNumber" placeholder={t("incidents.new.fields.incidentNumberPlaceholder")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="factoryCode">{t("incidents.new.fields.factoryCode")}</Label>
            <Input id="factoryCode" name="factoryCode" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base font-semibold">{t("incidents.new.sections.classification")}</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="occurredAt">{t("incidents.new.fields.occurredAt")}</Label>
            <Input
              id="occurredAt"
              name="occurredAt"
              type="datetime-local"
              defaultValue={nowLocal}
              required
              aria-invalid={!!state?.fieldErrors?.occurredAt}
            />
            <FieldError kind={state?.fieldErrors?.occurredAt} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("incidents.new.fields.category")}</Label>
            <Select name="categoryId" required>
              <SelectTrigger aria-invalid={!!state?.fieldErrors?.categoryId}>
                <SelectValue placeholder={t("incidents.new.selectCategoryPlaceholder")}>
                  {(value: string) => categories.find((c) => c.id === value)?.name ?? value}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <FieldError kind={state?.fieldErrors?.categoryId} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("incidents.new.fields.severity")}</Label>
            <Select name="severityId" required>
              <SelectTrigger aria-invalid={!!state?.fieldErrors?.severityId}>
                <SelectValue placeholder={t("incidents.new.selectSeverityPlaceholder")}>
                  {(value: string) => severities.find((s) => s.id === value)?.name ?? value}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {severities.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <FieldError kind={state?.fieldErrors?.severityId} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base font-semibold">{t("incidents.new.sections.location")}</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>{t("incidents.new.fields.orgUnit")}</Label>
            <Select name="orgUnitId">
              <SelectTrigger>
                <SelectValue placeholder={t("incidents.new.selectLocationPlaceholder")}>
                  {(value: string) => orgUnits.find((u) => u.id === value)?.name ?? value}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {orgUnits.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="locationDetail">{t("incidents.new.fields.locationDetail")}</Label>
            <Input id="locationDetail" name="locationDetail" placeholder={t("incidents.new.fields.locationDetailPlaceholder")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="equipment">{t("incidents.new.fields.equipment")}</Label>
            <Input id="equipment" name="equipment" placeholder={t("incidents.new.fields.equipmentPlaceholder")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("incidents.new.fields.employee")}</Label>
            <Select name="employeeId">
              <SelectTrigger>
                <SelectValue placeholder={t("incidents.new.selectEmployeePlaceholder")}>
                  {(value: string) => employees.find((e) => e.id === value)?.name ?? value}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("incidents.detail.responsiblePerson")}</Label>
            <Select name="responsiblePersonId">
              <SelectTrigger>
                <SelectValue placeholder={t("common.unassigned")}>
                  {(value: string) => employees.find((e) => e.id === value)?.name ?? value}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base font-semibold">{t("incidents.new.sections.description")}</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">{t("incidents.new.fields.description")}</Label>
            <Textarea id="description" name="description" required rows={3} aria-invalid={!!state?.fieldErrors?.description} />
            <FieldError kind={state?.fieldErrors?.description} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="immediateCause">{t("incidents.new.fields.immediateCause")}</Label>
              <Textarea id="immediateCause" name="immediateCause" rows={2} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rootCause">{t("incidents.new.fields.rootCause")}</Label>
              <Textarea id="rootCause" name="rootCause" rows={2} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="correctiveAction">{t("incidents.new.fields.correctiveAction")}</Label>
              <Textarea id="correctiveAction" name="correctiveAction" rows={2} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="preventiveAction">{t("incidents.new.fields.preventiveAction")}</Label>
              <Textarea id="preventiveAction" name="preventiveAction" rows={2} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="costVnd">{t("incidents.detail.costVnd")}</Label>
              <Input id="costVnd" name="costVnd" type="number" step="0.01" min="0" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="costRmb">{t("incidents.detail.costRmb")}</Label>
              <Input id="costRmb" name="costRmb" type="number" step="0.01" min="0" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pointsDeducted">{t("incidents.detail.pointsDeducted")}</Label>
              <Input id="pointsDeducted" name="pointsDeducted" type="number" step="0.1" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="injuredBodyPart">{t("incidents.detail.injuredBodyPart")}</Label>
              <Input id="injuredBodyPart" name="injuredBodyPart" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">{t("incidents.new.fields.notes")}</Label>
            <Input id="notes" name="notes" />
          </div>
        </CardContent>
      </Card>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? t("common.saving") : t("incidents.reportButton")}
        </Button>
      </div>
    </form>
  );
}
