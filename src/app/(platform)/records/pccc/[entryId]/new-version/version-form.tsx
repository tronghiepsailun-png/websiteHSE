"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useT } from "@/lib/i18n/locale-context";
import type { DictionaryKey } from "@/lib/i18n/translate";
import { createRecordVersionAction } from "./actions";
import { STATUS_BANNER_CLASS } from "@/lib/status-tone";

export type VersionFormState = { error?: string } | undefined;

type SameTypeDate = { orgUnitName: string; effectiveDate: string };

const FIVE_DAYS_MS = 5 * 86_400_000;

export function VersionForm({
  entryId,
  cycleMonths,
  sameTypeDates,
}: {
  entryId: string;
  cycleMonths: number | null;
  sameTypeDates: SameTypeDate[];
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState<VersionFormState, FormData>(createRecordVersionAction, undefined);
  const [dateConfidence, setDateConfidence] = useState("confirmed");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [expiresAtManualToggle, setExpiresAtManualToggle] = useState(false);

  const isUnknown = dateConfidence === "unknown";

  const expiryPreview =
    !isUnknown && effectiveDate && cycleMonths
      ? (() => {
          const d = new Date(effectiveDate);
          d.setMonth(d.getMonth() + cycleMonths);
          return d.toLocaleDateString();
        })()
      : null;

  const collision =
    !isUnknown && effectiveDate
      ? sameTypeDates.find((s) => Math.abs(new Date(s.effectiveDate).getTime() - new Date(effectiveDate).getTime()) <= FIVE_DAYS_MS)
      : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="entryId" value={entryId} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="driveUrl">{t("records.form.fields.driveUrl")}</Label>
          <Input id="driveUrl" name="driveUrl" type="url" placeholder={t("records.form.fields.driveUrlPlaceholder")} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fileName">{t("records.form.fields.fileName")}</Label>
          <Input id="fileName" name="fileName" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label>{t("records.form.fields.dateConfidence")}</Label>
          <Select name="dateConfidence" defaultValue="confirmed" onValueChange={(v) => setDateConfidence(v ?? "confirmed")}>
            <SelectTrigger>
              <SelectValue>{(v: string) => t(`records.dateConfidence.${v}` as DictionaryKey)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="confirmed">{t("records.dateConfidence.confirmed")}</SelectItem>
              <SelectItem value="estimated">{t("records.dateConfidence.estimated")}</SelectItem>
              <SelectItem value="unknown">{t("records.dateConfidence.unknown")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="effectiveDate">{t("records.form.fields.effectiveDate")}</Label>
          <Input
            id="effectiveDate"
            name="effectiveDate"
            type="date"
            disabled={isUnknown}
            value={effectiveDate}
            onChange={(e) => setEffectiveDate(e.target.value)}
          />
        </div>
      </div>

      {isUnknown && <p className="text-xs text-muted-foreground">{t("records.form.unknownDateHint")}</p>}

      {collision && (
        <p className={`rounded-md border px-3 py-2 text-xs ${STATUS_BANNER_CLASS.warning}`}>
          {t("records.form.dateCollisionWarning", {
            zone: collision.orgUnitName,
            date: new Date(collision.effectiveDate).toLocaleDateString(),
          })}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="dateSourceQuote">{t("records.form.fields.dateSourceQuote")}</Label>
        <Input id="dateSourceQuote" name="dateSourceQuote" placeholder={t("records.form.fields.dateSourceQuotePlaceholder")} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>{t("records.form.fields.expiresAt")}</Label>
        {!expiresAtManualToggle ? (
          <>
            <p className="text-sm font-medium">{expiryPreview ?? "—"}</p>
            <p className="text-xs text-muted-foreground">{t("records.form.expiryAutoNote")}</p>
          </>
        ) : (
          <Input name="expiresAtManual" type="date" />
        )}
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            name="expiresAtManualToggle"
            checked={expiresAtManualToggle}
            onChange={(e) => setExpiresAtManualToggle(e.target.checked)}
          />
          {t("records.form.fields.expiresAtManual")}
        </label>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>{t("records.form.fields.verificationStatus")}</Label>
        <Select name="verificationStatus" defaultValue="ok">
          <SelectTrigger>
            <SelectValue>{(v: string) => t(`records.verificationStatus.${v}` as DictionaryKey)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ok">{t("records.verificationStatus.ok")}</SelectItem>
            <SelectItem value="needs_verification">{t("records.verificationStatus.needs_verification")}</SelectItem>
            <SelectItem value="conflict">{t("records.verificationStatus.conflict")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notes">
          {t("records.form.fields.notes")}
          {isUnknown && <span className="ml-1 text-destructive">*</span>}
        </Label>
        <Textarea id="notes" name="notes" rows={3} required={isUnknown} />
        {isUnknown && <p className="text-xs text-muted-foreground">{t("records.form.notesRequiredWhenUnknown")}</p>}
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <div className="flex justify-end gap-2">
        <Link href={`/records/pccc/${entryId}`} className={buttonVariants({ variant: "outline" })}>
          {t("common.cancel")}
        </Link>
        <Button type="submit" disabled={pending}>
          {pending ? t("common.saving") : t("records.form.submit")}
        </Button>
      </div>
    </form>
  );
}
