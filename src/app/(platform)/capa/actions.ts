"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { requireOrgPermission } from "@/server/api-guard";
import { PERMISSIONS } from "@/server/permissions";
import { writeAuditLog } from "@/server/audit";
import { assertBelongsToOrg } from "@/server/org-context";
import { storageService, ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_SIZE_BYTES } from "@/server/storage";
import { CAPA_CLASSIFICATIONS } from "@/server/capa";
import { getLocale } from "@/lib/i18n/get-locale.server";
import { t } from "@/lib/i18n/translate";

export type CapaRowState = { error: string } | { success: true } | undefined;

const rowSchema = z.object({
  capaId: z.string().optional(),
  area: z.string().optional(),
  action: z.string().min(1),
  discoveredDate: z.string().optional(),
  classification: z.enum(CAPA_CLASSIFICATIONS).optional().or(z.literal("")),
  responsibleDept: z.string().optional(),
  dueDate: z.string().optional(),
  completionDate: z.string().optional(),
});

async function saveTaggedPhoto(params: { organizationId: string; capaId: string; tag: "before" | "after"; file: File; userId: string | null }) {
  let buffer = Buffer.from(await params.file.arrayBuffer());
  if (params.file.type.startsWith("image/")) {
    buffer = await sharp(buffer).resize(1024, 1024, { fit: "cover", position: sharp.strategy.attention }).toBuffer();
  }

  const existing = await prisma.document.findFirst({ where: { organizationId: params.organizationId, module: "capa", recordId: params.capaId, tag: params.tag } });
  if (existing) {
    await storageService.delete(existing.storagePath).catch(() => {});
    await prisma.document.delete({ where: { id: existing.id } });
  }

  const { storagePath } = await storageService.save({ organizationId: params.organizationId, module: "capa", recordId: params.capaId, fileName: params.file.name, buffer });
  await prisma.document.create({
    data: {
      organizationId: params.organizationId,
      module: "capa",
      recordId: params.capaId,
      tag: params.tag,
      fileName: params.file.name,
      fileType: params.file.type,
      sizeBytes: buffer.length,
      storageProvider: "local",
      storagePath,
      uploadedById: params.userId,
    },
  });
}

/** One inline table row's Save: creates a new CAPA (no capaId) or updates an existing one, and
 *  uploads whichever before/after photo was attached — all in a single round trip so the row
 *  never has to navigate to a separate page to finish itself. Status is never set by hand: it's
 *  "completed" the moment a confirmed date is entered, "open" otherwise — same as the org's own
 *  tracking sheet, which has no status column at all, only a filled-in "ngày xác nhận hoàn thành". */
export async function saveCapaRowAction(_prev: CapaRowState, formData: FormData): Promise<CapaRowState> {
  const isUpdate = !!formData.get("capaId");
  const ctx = await requireOrgPermission(isUpdate ? PERMISSIONS.CAPA_EDIT : PERMISSIONS.CAPA_CREATE);
  const locale = await getLocale();

  const raw = Object.fromEntries(formData.entries());
  const parsed = rowSchema.safeParse(raw);
  if (!parsed.success) return { error: t(locale, "records.form.errorGeneric") };
  const data = parsed.data;

  const beforeFile = formData.get("beforeFile");
  const afterFile = formData.get("afterFile");
  const hasBeforeFile = beforeFile instanceof File && beforeFile.size > 0;
  const hasAfterFile = afterFile instanceof File && afterFile.size > 0;
  for (const f of [hasBeforeFile ? beforeFile : null, hasAfterFile ? afterFile : null]) {
    if (!f) continue;
    if (f.size > MAX_UPLOAD_SIZE_BYTES) return { error: t(locale, "incidents.detail.uploadTooLarge") };
    if (!ALLOWED_UPLOAD_TYPES.has(f.type)) return { error: t(locale, "incidents.detail.uploadTypeNotAllowed") };
  }

  const fields = {
    action: data.action,
    area: data.area?.trim() || null,
    discoveredDate: data.discoveredDate ? new Date(data.discoveredDate) : null,
    classification: data.classification || null,
    responsibleDept: data.responsibleDept?.trim() || null,
    dueDate: data.dueDate ? new Date(data.dueDate) : null,
    completionDate: data.completionDate ? new Date(data.completionDate) : null,
    status: data.completionDate ? "completed" : "open",
  };

  let capaId: string;
  if (isUpdate) {
    capaId = data.capaId!;
    const before = await prisma.capaItem.findUnique({ where: { id: capaId } });
    assertBelongsToOrg(before, ctx.organizationId);
    await prisma.capaItem.update({ where: { id: capaId }, data: fields });
    await writeAuditLog({ organizationId: ctx.organizationId, userId: ctx.userId, module: "capa", recordType: "CapaItem", recordId: capaId, action: "update" });
  } else {
    const created = await prisma.capaItem.create({
      data: { organizationId: ctx.organizationId, sourceModule: null, sourceRecordId: null, createdById: ctx.userId, ...fields },
    });
    capaId = created.id;
    await writeAuditLog({ organizationId: ctx.organizationId, userId: ctx.userId, module: "capa", recordType: "CapaItem", recordId: capaId, action: "create" });
  }

  if (hasBeforeFile) await saveTaggedPhoto({ organizationId: ctx.organizationId, capaId, tag: "before", file: beforeFile as File, userId: ctx.userId });
  if (hasAfterFile) await saveTaggedPhoto({ organizationId: ctx.organizationId, capaId, tag: "after", file: afterFile as File, userId: ctx.userId });

  revalidatePath("/capa");
  return { success: true };
}

/** Kanban drop handler. CAPA has no hand-set status — "completed" is derived from a filled-in
 *  completion date (see saveCapaRowAction) — so moving a card between columns means filling in
 *  or clearing that date, and the status follows from it exactly as it does in the table. */
export async function setCapaCompletedAction(capaId: string, completed: boolean) {
  const ctx = await requireOrgPermission(PERMISSIONS.CAPA_EDIT);

  const capa = await prisma.capaItem.findUnique({ where: { id: capaId } });
  assertBelongsToOrg(capa, ctx.organizationId);

  // Keep an existing completion date when re-completing, so a card dragged out and back doesn't
  // silently overwrite the real date someone typed in the table.
  const completionDate = completed ? (capa!.completionDate ?? new Date()) : null;

  await prisma.capaItem.update({
    where: { id: capaId },
    data: { completionDate, status: completed ? "completed" : "open" },
  });

  await writeAuditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    module: "capa",
    recordType: "CapaItem",
    recordId: capaId,
    action: "update",
    changes: [{ field: "status", oldValue: capa!.status, newValue: completed ? "completed" : "open" }],
  });

  revalidatePath("/capa");
}

export async function deleteCapaAction(capaId: string) {
  const ctx = await requireOrgPermission(PERMISSIONS.CAPA_DELETE);

  const capa = await prisma.capaItem.findUnique({ where: { id: capaId } });
  assertBelongsToOrg(capa, ctx.organizationId);

  const docs = await prisma.document.findMany({ where: { organizationId: ctx.organizationId, module: "capa", recordId: capaId } });
  for (const doc of docs) {
    await storageService.delete(doc.storagePath).catch(() => {});
  }
  await prisma.document.deleteMany({ where: { organizationId: ctx.organizationId, module: "capa", recordId: capaId } });
  await prisma.capaItem.delete({ where: { id: capaId } });

  await writeAuditLog({ organizationId: ctx.organizationId, userId: ctx.userId, module: "capa", recordType: "CapaItem", recordId: capaId, action: "delete" });

  revalidatePath("/capa");
}
