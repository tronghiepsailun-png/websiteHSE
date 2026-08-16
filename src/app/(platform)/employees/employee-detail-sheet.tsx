"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/lib/i18n/locale-context";
import type { DictionaryKey } from "@/lib/i18n/translate";
import { STATUS_OUTLINE_CLASS } from "@/lib/status-tone";

export type EmployeeDetailData = {
  employeeCode: string;
  fullName: string;
  fullNameZh: string | null;
  gender: string | null;
  education: string | null;
  birthDate: Date | null;
  nationalId: string | null;
  orgUnitLevel1: string | null;
  region: string | null;
  costCenterName: string | null;
  orgUnitLevel2: string | null;
  team: string | null;
  shift: string | null;
  position: string | null;
  status: string;
  email: string | null;
  phone: string | null;
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value || "—"}</span>
    </div>
  );
}

export function EmployeeDetailSheet({
  employee,
  open,
  onOpenChange,
}: {
  employee: EmployeeDetailData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{employee.fullName}</SheetTitle>
          <SheetDescription>{employee.employeeCode}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4 pb-4">
          <Badge variant={employee.status === "active" ? "outline" : "secondary"} className={employee.status === "active" ? STATUS_OUTLINE_CLASS.success : ""}>
            {t(`employees.status.${employee.status}` as DictionaryKey)}
          </Badge>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t("employees.field.fullName")} value={employee.fullName} />
            <Field label={t("employees.field.fullNameZh")} value={employee.fullNameZh ?? ""} />
            <Field label={t("employees.field.gender")} value={employee.gender ? t(`employees.gender.${employee.gender}` as DictionaryKey) : ""} />
            <Field label={t("employees.field.birthDate")} value={employee.birthDate ? employee.birthDate.toLocaleDateString() : ""} />
            <Field label={t("employees.field.education")} value={employee.education ?? ""} />
            <Field label={t("employees.field.nationalId")} value={employee.nationalId ?? ""} />
          </div>

          <div className="border-t pt-3">
            <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t("employees.detail.orgSection")}</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("employees.field.orgUnitLevel1")} value={employee.orgUnitLevel1 ?? ""} />
              <Field label={t("employees.field.orgUnitLevel2")} value={employee.orgUnitLevel2 ?? ""} />
              <Field label={t("employees.field.region")} value={employee.region ?? ""} />
              <Field label={t("employees.field.costCenterName")} value={employee.costCenterName ?? ""} />
              <Field label={t("employees.field.team")} value={employee.team ?? ""} />
              <Field label={t("employees.field.shift")} value={employee.shift ?? ""} />
              <Field label={t("employees.field.position")} value={employee.position ?? ""} />
            </div>
          </div>

          <div className="border-t pt-3">
            <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t("employees.detail.contactSection")}</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("common.email")} value={employee.email ?? ""} />
              <Field label={t("employees.field.phone")} value={employee.phone ?? ""} />
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
