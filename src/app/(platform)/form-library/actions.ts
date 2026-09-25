"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrgPermission } from "@/server/api-guard";
import { PERMISSIONS } from "@/server/permissions";
import { writeAuditLog } from "@/server/audit";
import { assertBelongsToOrg } from "@/server/org-context";
import { storageService, MAX_UPLOAD_SIZE_BYTES } from "@/server/storage";
import { ARCHIVED_TAG, FORMS_MODULE, formFileMime } from "@/server/forms";
import { getLocale } from "@/lib/i18n/get-locale.server";
import { t } from "@/lib/i18n/translate";

export type FormActionResult = { error: string } | { success: true };

const fieldsSchema = z.object({
  categoryId: z.string().min(1),
  code: z.string().trim().max(50).optional(),
  nameVi: z.string().trim().min(1).max(300),
  nameZh: z.string().trim().max(300).optional(),
  descriptionVi: z.string().trim().max(500).optional(),
  descriptionZh: z.string().trim().max(500).optional(),
});

function pickFields(formData: FormData) {
  const text = (key: string) => {
    const v = formData.get(key);
    return typeof v === "string" ? v : undefined;
  };
  return {
    categoryId: text("categoryId") ?? "",
    code: text("code"),
    nameVi: text("nameVi") ?? "",
    nameZh: text("nameZh"),
    descriptionVi: text("descriptionVi"),
    descriptionZh: text("descriptionZh"),
  };
}

function uploadedFiles(formData: FormData, key: string): File[] {
  return formData.getAll(key).filter((f): f is File => f instanceof File && f.size > 0);
}

/** Returns a translated error for the first file that is too big or not an allowed type. */
function checkFiles(files: File[], locale: Awaited<ReturnType<typeof getLocale>>): string | null {
  for (const f of files) {
    if (f.size > MAX_UPLOAD_SIZE_BYTES) return t(locale, "forms.error.fileSize");
    if (!formFileMime(f.name)) return t(locale, "forms.error.fileType");
  }
  return null;
}

async function saveFiles(params: { organizationId: string; formId: string; files: File[]; userId: string }) {
  for (const file of params.files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { storagePath } = await storageService.save({ organizationId: params.organizationId, module: FORMS_MODULE, recordId: params.formId, fileName: file.name, buffer });
    await prisma.document.create({
      data: {
        organizationId: params.organizationId,
        module: FORMS_MODULE,
        recordId: params.formId,
        fileName: file.name,
        fileType: formFileMime(file.name) ?? file.type ?? "application/octet-stream",
        sizeBytes: buffer.length,
        storageProvider: "local",
        storagePath,
        uploadedById: params.userId,
      },
    });
  }
}

async function audit(ctx: { organizationId: string; userId: string }, recordId: string, action: "create" | "update" | "delete") {
  await writeAuditLog({ organizationId: ctx.organizationId, userId: ctx.userId, module: FORMS_MODULE, recordType: "FormTemplate", recordId, action });
}

function refresh() {
  revalidatePath("/form-library");
}

async function categoryBelongsToOrg(organizationId: string, categoryId: string) {
  const category = await prisma.catalogItem.findUnique({ where: { id: categoryId }, select: { organizationId: true, module: true, kind: true } });
  return category !== null && category.organizationId === organizationId && category.module === FORMS_MODULE && category.kind === "category";
}

export async function createFormAction(formData: FormData): Promise<FormActionResult> {
  const ctx = await requireOrgPermission(PERMISSIONS.FORMS_EDIT);
  const locale = await getLocale();
  const parsed = fieldsSchema.safeParse(pickFields(formData));
  if (!parsed.success) return { error: t(locale, "forms.error.generic") };
  if (!(await categoryBelongsToOrg(ctx.organizationId, parsed.data.categoryId))) return { error: t(locale, "forms.error.category") };

  const files = uploadedFiles(formData, "files");
  if (files.length === 0) return { error: t(locale, "forms.error.needFile") };
  const fileError = checkFiles(files, locale);
  if (fileError) return { error: fileError };

  const d = parsed.data;
  const form = await prisma.formTemplate.create({
    data: {
      organizationId: ctx.organizationId,
      categoryId: d.categoryId,
      code: d.code || null,
      nameVi: d.nameVi,
      nameZh: d.nameZh || null,
      descriptionVi: d.descriptionVi || null,
      descriptionZh: d.descriptionZh || null,
      createdById: ctx.userId,
    },
  });
  await saveFiles({ organizationId: ctx.organizationId, formId: form.id, files, userId: ctx.userId });
  await audit(ctx, form.id, "create");
  refresh();
  return { success: true };
}

async function loadForm(id: string, organizationId: string) {
  const form = await prisma.formTemplate.findUnique({ where: { id } });
  assertBelongsToOrg(form, organizationId);
  return form!;
}

export async function updateFormAction(formData: FormData): Promise<FormActionResult> {
  const ctx = await requireOrgPermission(PERMISSIONS.FORMS_EDIT);
  const locale = await getLocale();
  const id = String(formData.get("id") ?? "");
  const parsed = fieldsSchema.safeParse(pickFields(formData));
  if (!id || !parsed.success) return { error: t(locale, "forms.error.generic") };
  await loadForm(id, ctx.organizationId);
  if (!(await categoryBelongsToOrg(ctx.organizationId, parsed.data.categoryId))) return { error: t(locale, "forms.error.category") };

  const files = uploadedFiles(formData, "files");
  const fileError = checkFiles(files, locale);
  if (fileError) return { error: fileError };

  const d = parsed.data;
  await prisma.formTemplate.update({
    where: { id },
    data: {
      categoryId: d.categoryId,
      code: d.code || null,
      nameVi: d.nameVi,
      nameZh: d.nameZh || null,
      descriptionVi: d.descriptionVi || null,
      descriptionZh: d.descriptionZh || null,
    },
  });
  if (files.length > 0) await saveFiles({ organizationId: ctx.organizationId, formId: id, files, userId: ctx.userId });
  await audit(ctx, id, "update");
  refresh();
  return { success: true };
}

export async function replaceFormFileAction(formData: FormData): Promise<FormActionResult> {
  const ctx = await requireOrgPermission(PERMISSIONS.FORMS_EDIT);
  const locale = await getLocale();
  const docId = String(formData.get("docId") ?? "");
  const [file] = uploadedFiles(formData, "file");
  if (!docId || !file) return { error: t(locale, "forms.error.needFile") };
  const fileError = checkFiles([file], locale);
  if (fileError) return { error: fileError };

  const doc = await prisma.document.findUnique({ where: { id: docId } });
  if (!doc || doc.organizationId !== ctx.organizationId || doc.module !== FORMS_MODULE) return { error: t(locale, "forms.error.generic") };

  // The old file is archived (kept, just not listed) rather than deleted, so a wrong upload can be recovered.
  await prisma.document.update({ where: { id: docId }, data: { tag: ARCHIVED_TAG } });
  await saveFiles({ organizationId: ctx.organizationId, formId: doc.recordId, files: [file], userId: ctx.userId });
  await audit(ctx, doc.recordId, "update");
  refresh();
  return { success: true };
}

export async function deleteFormFileAction(docId: string): Promise<FormActionResult> {
  const ctx = await requireOrgPermission(PERMISSIONS.FORMS_EDIT);
  const locale = await getLocale();
  const doc = await prisma.document.findUnique({ where: { id: docId } });
  if (!doc || doc.organizationId !== ctx.organizationId || doc.module !== FORMS_MODULE) return { error: t(locale, "forms.error.generic") };

  await storageService.delete(doc.storagePath).catch(() => {});
  await prisma.document.delete({ where: { id: docId } });
  await audit(ctx, doc.recordId, "update");
  refresh();
  return { success: true };
}

export async function toggleFormActiveAction(id: string, isActive: boolean): Promise<FormActionResult> {
  const ctx = await requireOrgPermission(PERMISSIONS.FORMS_EDIT);
  await loadForm(id, ctx.organizationId);
  await prisma.formTemplate.update({ where: { id }, data: { isActive } });
  await audit(ctx, id, "update");
  refresh();
  return { success: true };
}

export async function deleteFormAction(id: string): Promise<FormActionResult> {
  const ctx = await requireOrgPermission(PERMISSIONS.FORMS_EDIT);
  await loadForm(id, ctx.organizationId);

  const docs = await prisma.document.findMany({ where: { organizationId: ctx.organizationId, module: FORMS_MODULE, recordId: id } });
  for (const doc of docs) await storageService.delete(doc.storagePath).catch(() => {});
  await prisma.document.deleteMany({ where: { organizationId: ctx.organizationId, module: FORMS_MODULE, recordId: id } });
  await prisma.formTemplate.delete({ where: { id } });
  await audit(ctx, id, "delete");
  refresh();
  return { success: true };
}
