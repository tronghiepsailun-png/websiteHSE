"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrgPermission } from "@/server/api-guard";
import { PERMISSIONS } from "@/server/permissions";
import { WORK_PLAN_STATUSES, getNextSortOrder } from "@/server/work-plan";
import { writeAuditLog } from "@/server/audit";
import { getLocale } from "@/lib/i18n/get-locale.server";
import { t } from "@/lib/i18n/translate";
import { zodFieldErrors, type FieldErrors } from "@/lib/form-errors";

async function assertDocumentInOrg(documentId: string, organizationId: string) {
  const doc = await prisma.workPlanDocument.findUnique({ where: { id: documentId } });
  if (!doc || doc.organizationId !== organizationId) throw new Error("Work plan document not found");
  return doc;
}

// ── Documents ──────────────────────────────────────────────────────────

const createDocumentSchema = z.object({ name: z.string().min(1) });

export type CreateDocumentState = { error?: string } | undefined;

export async function createWorkPlanDocumentAction(_prev: CreateDocumentState, formData: FormData): Promise<CreateDocumentState> {
  const ctx = await requireOrgPermission(PERMISSIONS.WORKPLAN_EDIT);
  const parsed = createDocumentSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { error: t(await getLocale(), "workplan.form.errorGeneric") };

  const doc = await prisma.workPlanDocument.create({
    data: { organizationId: ctx.organizationId, name: parsed.data.name, createdById: ctx.userId },
  });

  await writeAuditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    module: "workplan",
    recordType: "WorkPlanDocument",
    recordId: doc.id,
    action: "create",
  });

  revalidatePath("/planning");
  redirect(`/planning?doc=${doc.id}`);
}

export async function renameWorkPlanDocumentAction(formData: FormData) {
  const ctx = await requireOrgPermission(PERMISSIONS.WORKPLAN_EDIT);
  const id = String(formData.get("id"));
  const name = String(formData.get("name") || "").trim();
  if (!name) return;

  await assertDocumentInOrg(id, ctx.organizationId);
  await prisma.workPlanDocument.update({ where: { id }, data: { name } });

  await writeAuditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    module: "workplan",
    recordType: "WorkPlanDocument",
    recordId: id,
    action: "update",
    changes: [{ field: "name", oldValue: null, newValue: name }],
  });

  revalidatePath("/planning");
}

export async function deleteWorkPlanDocumentAction(id: string) {
  const ctx = await requireOrgPermission(PERMISSIONS.WORKPLAN_DELETE);
  const doc = await prisma.workPlanDocument.findUnique({ where: { id } });
  if (!doc || doc.organizationId !== ctx.organizationId) return;

  await prisma.workPlanDocument.delete({ where: { id } }); // cascades to its items

  await writeAuditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    module: "workplan",
    recordType: "WorkPlanDocument",
    recordId: id,
    action: "delete",
    changes: [{ field: "name", oldValue: doc.name, newValue: null }],
  });

  revalidatePath("/planning");
  redirect("/planning");
}

// ── Items ──────────────────────────────────────────────────────────────

const itemSchema = z.object({
  documentId: z.string().min(1),
  phase: z.string().optional(),
  title: z.string().min(1),
  responsibleName: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.enum(WORK_PLAN_STATUSES),
  progressPercent: z.coerce.number().int().min(0).max(100),
  notes: z.string().optional(),
});

export type ItemFormState = { success: true } | { error: string; fieldErrors?: FieldErrors } | undefined;

export async function createWorkPlanItemAction(_prev: ItemFormState, formData: FormData): Promise<ItemFormState> {
  const ctx = await requireOrgPermission(PERMISSIONS.WORKPLAN_EDIT);
  const parsed = itemSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: t(await getLocale(), "workplan.form.errorGeneric"), fieldErrors: zodFieldErrors(parsed.error) };
  const data = parsed.data;

  await assertDocumentInOrg(data.documentId, ctx.organizationId);
  const sortOrder = await getNextSortOrder(data.documentId);

  const created = await prisma.workPlanItem.create({
    data: {
      documentId: data.documentId,
      phase: data.phase?.trim() || null,
      title: data.title,
      responsibleName: data.responsibleName?.trim() || null,
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null,
      status: data.status,
      progressPercent: data.progressPercent,
      notes: data.notes?.trim() || null,
      sortOrder,
    },
  });

  await writeAuditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    module: "workplan",
    recordType: "WorkPlanItem",
    recordId: created.id,
    action: "create",
  });

  revalidatePath("/planning");
  return { success: true };
}

const updateItemSchema = itemSchema.extend({ id: z.string().min(1) });

export async function updateWorkPlanItemAction(_prev: ItemFormState, formData: FormData): Promise<ItemFormState> {
  const ctx = await requireOrgPermission(PERMISSIONS.WORKPLAN_EDIT);
  const parsed = updateItemSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: t(await getLocale(), "workplan.form.errorGeneric"), fieldErrors: zodFieldErrors(parsed.error) };
  const data = parsed.data;

  await assertDocumentInOrg(data.documentId, ctx.organizationId);
  const before = await prisma.workPlanItem.findUnique({ where: { id: data.id } });
  if (!before || before.documentId !== data.documentId) return { error: t(await getLocale(), "workplan.form.errorGeneric") };

  await prisma.workPlanItem.update({
    where: { id: data.id },
    data: {
      phase: data.phase?.trim() || null,
      title: data.title,
      responsibleName: data.responsibleName?.trim() || null,
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null,
      status: data.status,
      progressPercent: data.progressPercent,
      notes: data.notes?.trim() || null,
    },
  });

  await writeAuditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    module: "workplan",
    recordType: "WorkPlanItem",
    recordId: data.id,
    action: "update",
  });

  revalidatePath("/planning");
  return { success: true };
}

async function getItemInOrg(id: string, organizationId: string) {
  const item = await prisma.workPlanItem.findUnique({ where: { id }, include: { document: true } });
  if (!item || item.document.organizationId !== organizationId) return null;
  return item;
}

/** Quick-pick from the table row's % buttons — sets progress straight to that milestone and
 *  updates the item's one shared note in a single action, no need to open the full edit dialog. */
export async function setWorkPlanProgressAction(id: string, percent: number, notes: string) {
  const ctx = await requireOrgPermission(PERMISSIONS.WORKPLAN_EDIT);
  const item = await getItemInOrg(id, ctx.organizationId);
  if (!item) return;

  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  await prisma.workPlanItem.update({
    where: { id },
    data: {
      progressPercent: clamped,
      notes: notes.trim() || null,
      status: clamped === 100 ? "completed" : item.status === "completed" ? "in_progress" : item.status,
    },
  });

  revalidatePath("/planning");
}

export async function deleteWorkPlanItemAction(id: string) {
  const ctx = await requireOrgPermission(PERMISSIONS.WORKPLAN_DELETE);
  const item = await getItemInOrg(id, ctx.organizationId);
  if (!item) return;

  await prisma.workPlanItem.delete({ where: { id } });

  await writeAuditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    module: "workplan",
    recordType: "WorkPlanItem",
    recordId: id,
    action: "delete",
  });

  revalidatePath("/planning");
}
