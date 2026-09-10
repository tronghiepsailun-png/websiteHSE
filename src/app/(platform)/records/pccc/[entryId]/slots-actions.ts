"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOrgPermission } from "@/server/api-guard";
import { PERMISSIONS } from "@/server/permissions";
import { setEntrySlotFile, clearEntrySlot } from "@/server/records";
import { storageService, ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_SIZE_BYTES } from "@/server/storage";
import { RECORD_ENTRY_SLOT_COUNT } from "@/lib/records-constants";
import { getLocale } from "@/lib/i18n/get-locale.server";
import { t } from "@/lib/i18n/translate";

export type SlotFormState = { error: string } | { success: true } | undefined;

const schema = z.object({
  entryId: z.string().min(1),
  slotIndex: z.coerce.number().int().min(1).max(RECORD_ENTRY_SLOT_COUNT),
  driveUrl: z.string().optional(),
  fileName: z.string().optional(),
  startDate: z.string().optional(),
  expiresAt: z.string().optional(),
});

export async function setEntrySlotFileAction(_prev: SlotFormState, formData: FormData): Promise<SlotFormState> {
  const ctx = await requireOrgPermission(PERMISSIONS.RECORDS_EDIT);
  const locale = await getLocale();

  const raw = Object.fromEntries(formData.entries());
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { error: t(locale, "records.form.errorGeneric") };
  const data = parsed.data;

  const file = formData.get("file");
  const hasFile = file instanceof File && file.size > 0;
  const driveUrl = data.driveUrl?.trim();

  if (!hasFile && !driveUrl) return { error: t(locale, "records.slots.errorNoFile") };
  if (hasFile) {
    if (file.size > MAX_UPLOAD_SIZE_BYTES) return { error: t(locale, "records.form.errorFileTooLarge") };
    if (!ALLOWED_UPLOAD_TYPES.has(file.type)) return { error: t(locale, "records.form.errorFileTypeNotAllowed") };
  }

  const startDate = data.startDate ? new Date(data.startDate) : null;
  const expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;

  if (hasFile) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { storagePath } = await storageService.save({
      organizationId: ctx.organizationId,
      module: "record-slot",
      recordId: data.entryId,
      fileName: file.name,
      buffer,
    });
    await setEntrySlotFile({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      entryId: data.entryId,
      slotIndex: data.slotIndex,
      startDate,
      expiresAt,
      fileName: file.name,
      storageType: "upload",
      storagePath,
      sizeBytes: buffer.length,
      mimeType: file.type,
    });
  } else {
    await setEntrySlotFile({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      entryId: data.entryId,
      slotIndex: data.slotIndex,
      startDate,
      expiresAt,
      fileName: data.fileName?.trim() || driveUrl!,
      storageType: "drive_link",
      url: driveUrl!,
    });
  }

  revalidatePath(`/records/pccc/${data.entryId}`);
  return { success: true };
}

export async function clearEntrySlotAction(entryId: string, slotIndex: number) {
  const ctx = await requireOrgPermission(PERMISSIONS.RECORDS_EDIT);
  await clearEntrySlot(ctx.organizationId, ctx.userId, entryId, slotIndex);
  revalidatePath(`/records/pccc/${entryId}`);
}
