"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useT } from "@/lib/i18n/locale-context";
import type { DictionaryKey } from "@/lib/i18n/translate";

export type EmployeeFormState = { error?: string } | undefined;
type EmployeeFormAction = (prev: EmployeeFormState, formData: FormData) => Promise<EmployeeFormState>;

export type EmployeeFormValues = {
  employeeCode?: string;
  fullName?: string;
  fullNameZh?: string;
  gender?: string;
  education?: string;
  birthDate?: string; // yyyy-mm-dd
  nationalId?: string;
  orgUnitLevel1?: string;
  region?: string;
  costCenterName?: string;
  orgUnitLevel2?: string;
  team?: string;
  shift?: string;
  position?: string;
  status?: string;
};

export function EmployeeForm({
  action,
  initialValues,
  mode,
  submitLabelKey,
  employeeId,
}: {
  action: EmployeeFormAction;
  initialValues?: EmployeeFormValues;
  mode: "create" | "edit";
  submitLabelKey: DictionaryKey;
  employeeId?: string;
}) {
  const [state, formAction, pending] = useActionState<EmployeeFormState, FormData>(action, undefined);
  const t = useT();
  const v = initialValues ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {employeeId && <input type="hidden" name="employeeId" value={employeeId} />}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("employees.form.sections.identity")}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="employeeCode">{t("employees.field.employeeCode")}</Label>
            <Input id="employeeCode" name="employeeCode" defaultValue={v.employeeCode} required disabled={mode === "edit"} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fullName">{t("employees.field.fullName")}</Label>
            <Input id="fullName" name="fullName" defaultValue={v.fullName} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fullNameZh">{t("employees.field.fullNameZh")}</Label>
            <Input id="fullNameZh" name="fullNameZh" defaultValue={v.fullNameZh} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("employees.field.gender")}</Label>
            <Select name="gender" defaultValue={v.gender ?? "unset"}>
              <SelectTrigger>
                <SelectValue placeholder={t("employees.field.gender")}>
                  {(value: string) => (value === "unset" ? "—" : t(`employees.gender.${value}` as DictionaryKey))}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unset">—</SelectItem>
                <SelectItem value="male">{t("employees.gender.male")}</SelectItem>
                <SelectItem value="female">{t("employees.gender.female")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="birthDate">{t("employees.field.birthDate")}</Label>
            <Input id="birthDate" name="birthDate" type="date" defaultValue={v.birthDate} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="education">{t("employees.field.education")}</Label>
            <Input id="education" name="education" defaultValue={v.education} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nationalId">{t("employees.field.nationalId")}</Label>
            <Input id="nationalId" name="nationalId" defaultValue={v.nationalId} />
          </div>
          {mode === "edit" && (
            <div className="flex flex-col gap-1.5">
              <Label>{t("common.status")}</Label>
              <Select name="status" defaultValue={v.status ?? "active"}>
                <SelectTrigger>
                  <SelectValue placeholder={t("common.status")}>
                    {(value: string) => t(`employees.status.${value}` as DictionaryKey)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{t("employees.status.active")}</SelectItem>
                  <SelectItem value="resigned">{t("employees.status.resigned")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("employees.form.sections.org")}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="orgUnitLevel1">{t("employees.field.orgUnitLevel1")}</Label>
            <Input id="orgUnitLevel1" name="orgUnitLevel1" defaultValue={v.orgUnitLevel1} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="orgUnitLevel2">{t("employees.field.orgUnitLevel2")}</Label>
            <Input id="orgUnitLevel2" name="orgUnitLevel2" defaultValue={v.orgUnitLevel2} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="region">{t("employees.field.region")}</Label>
            <Input id="region" name="region" defaultValue={v.region} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="costCenterName">{t("employees.field.costCenterName")}</Label>
            <Input id="costCenterName" name="costCenterName" defaultValue={v.costCenterName} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="team">{t("employees.field.team")}</Label>
            <Input id="team" name="team" defaultValue={v.team} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="shift">{t("employees.field.shift")}</Label>
            <Input id="shift" name="shift" defaultValue={v.shift} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="position">{t("employees.field.position")}</Label>
            <Input id="position" name="position" defaultValue={v.position} />
          </div>
        </CardContent>
      </Card>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? t("common.saving") : t(submitLabelKey)}
        </Button>
      </div>
    </form>
  );
}
