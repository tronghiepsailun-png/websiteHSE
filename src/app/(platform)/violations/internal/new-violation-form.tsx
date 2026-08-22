"use client";

import { useActionState, useMemo, useState } from "react";
import { createViolationAction, type CreateViolationState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useT } from "@/lib/i18n/locale-context";

type Officer = {
  id: string;
  employeeCode: string;
  fullName: string;
  fullNameZh: string | null;
  dept1: string | null;
  dept2: string | null;
  region: string | null;
  shift: string | null;
};

type ViolationType = { id: string; labelVi: string; labelZh: string | null };

function todayLocal() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
}

export function NewViolationForm({ officers, violationTypes }: { officers: Officer[]; violationTypes: ViolationType[] }) {
  const [state, formAction, pending] = useActionState<CreateViolationState, FormData>(createViolationAction, undefined);
  const t = useT();
  const [officerId, setOfficerId] = useState<string | undefined>(undefined);

  const selectedOfficer = useMemo(() => officers.find((o) => o.id === officerId), [officers, officerId]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="occurredAt">{t("violations.form.date")}</Label>
          <Input id="occurredAt" name="occurredAt" type="date" defaultValue={todayLocal()} required />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label>{t("violations.form.officer")}</Label>
          <Select name="safetyOfficerId" onValueChange={(v) => setOfficerId(v as string)} required>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t("violations.form.selectOfficerPlaceholder")}>
                {(value: string) => {
                  const o = officers.find((x) => x.id === value);
                  return o ? `${o.employeeCode} — ${o.fullName}` : value;
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {officers.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.employeeCode} — {o.fullName}
                  {o.fullNameZh ? ` (${o.fullNameZh})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="amountVnd">{t("violations.form.amount")}</Label>
          <Input id="amountVnd" name="amountVnd" type="number" step="1000" min="0" defaultValue={10000} required />
        </div>
      </div>

      {/* Auto-filled from the selected officer's employee record — read-only, mirrors the
          source spreadsheet's VLOOKUP-driven MSNV/department columns. */}
      <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-3 text-sm sm:grid-cols-4">
        <div>
          <p className="text-xs text-muted-foreground">{t("violations.table.code")}</p>
          <p className="font-medium">{selectedOfficer?.employeeCode ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t("violations.table.department")}</p>
          <p className="font-medium">{[selectedOfficer?.dept1, selectedOfficer?.dept2].filter(Boolean).join(" / ") || "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t("violations.table.area")}</p>
          <p className="font-medium">{selectedOfficer?.region ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t("violations.table.shift")}</p>
          <p className="font-medium">{selectedOfficer?.shift ?? "—"}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-1.5">
          <Label>{t("violations.form.violationType")}</Label>
          <Select name="violationTypeId" required>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t("violations.form.selectTypePlaceholder")}>
                {(value: string) => violationTypes.find((v) => v.id === value)?.labelVi ?? value}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {violationTypes.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.labelVi}
                  {v.labelZh ? ` / ${v.labelZh}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="note">{t("violations.form.note")}</Label>
          <Input id="note" name="note" />
        </div>
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? t("common.saving") : t("violations.form.submit")}
        </Button>
      </div>
    </form>
  );
}
