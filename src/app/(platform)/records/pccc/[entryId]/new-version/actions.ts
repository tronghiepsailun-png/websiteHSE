"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrgPermission } from "@/server/api-guard";
import { PERMISSIONS } from "@/server/permissions";
import { assertBelongsToOrg } from "@/server/org-context";
import { createRecordVersion, DATE_CONFIDENCES, VERIFICATION_STATUSES } from "@/server/records";
import { getLocale } from "@/lib/i18n/get-locale.server";
import { t } from "@/lib/i18n/translate";
import type { VersionFormState } from "./version-form";

const schema = z.object({
  entryId: z.string().min(1),
  driveUrl: z.string().optional(),
  fileName: z.string().optional(),
  effectiveDate: z.string().optional(),
  dateSourceQuote: z.string().optional(),
  dateConfidence: z.enum(DATE_CONFIDENCES),
  expiresAtManualToggle: z.string().optional(),
  expiresAtManual: z.string().optional(),
  verificationStatus: z.enum(VERIFICATION_STATUSES),
  notes: z.string().optional(),
});

export async function createRecordVersionAction(_prev: VersionFormState, formData: FormData): Promise<VersionFormState> {
  const ctx = await requireOrgPermission(PERMISSIONS.RECORDS_MANAGE);
  const locale = await getLocale();

  const raw = Object.fromEntries(formData.entries());
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { error: t(locale, "records.form.errorGeneric") };
  const data = parsed.data;

  if (data.dateConfidence === "unknown" && !data.notes?.trim()) {
    return { error: t(locale, "records.form.errorNotesRequired") };
  }

  const entry = await prisma.recordEntry.findUnique({ where: { id: data.entryId } });
  assertBelongsToOrg(entry, ctx.organizationId);

  const files =
    data.driveUrl && data.driveUrl.trim()
      ? [{ fileName: data.fileName?.trim() || data.driveUrl.trim(), storageType: "drive_link" as const, url: data.driveUrl.trim() }]
      : [];

  await createRecordVersion({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    entryId: data.entryId,
    effectiveDate: data.dateConfidence !== "unknown" && data.effectiveDate ? new Date(data.effectiveDate) : null,
    dateSourceQuote: data.dateSourceQuote?.trim() || null,
    dateConfidence: data.dateConfidence,
    expiresAtOverride: data.expiresAtManualToggle === "on" && data.expiresAtManual ? new Date(data.expiresAtManual) : null,
    verificationStatus: data.verificationStatus,
    notes: data.notes?.trim() || null,
    files,
  });

  redirect(`/records/pccc/${data.entryId}`);
}
