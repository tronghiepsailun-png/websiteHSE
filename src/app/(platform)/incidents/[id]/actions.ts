"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { requireOrgPermission } from "@/server/api-guard";
import { PERMISSIONS } from "@/server/permissions";
import { writeAuditLog, diffFields } from "@/server/audit";
import { assertBelongsToOrg } from "@/server/org-context";
import { storageService, ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_SIZE_BYTES } from "@/server/storage";
import { INCIDENT_STATUSES, MAX_INCIDENT_PHOTOS } from "@/server/incidents";
import { getLocale } from "@/lib/i18n/get-locale.server";
import { t } from "@/lib/i18n/translate";

const updateSchema = z.object({
  incidentId: z.string().min(1),
  status: z.enum(INCIDENT_STATUSES).optional(),
  immediateCause: z.string().optional(),
  rootCause: z.string().optional(),
  correctiveAction: z.string().optional(),
  preventiveAction: z.string().optional(),
  responsiblePersonId: z.string().optional(),
  severityId: z.string().optional(),
  costVnd: z.string().optional(),
  dueDate: z.string().optional(),
  completionDate: z.string().optional(),
  notes: z.string().optional(),
});

const TEXT_FIELDS = ["immediateCause", "rootCause", "correctiveAction", "preventiveAction", "notes"] as const;
const DATE_FIELDS = ["dueDate", "completionDate"] as const;

// responsiblePersonId comes straight from a form field and references Employee, so it must be
// re-checked against the caller's own org before being trusted — otherwise a stale or crafted
// id could link another org's employee into this org's incident/CAPA record.
async function resolveResponsiblePersonId(id: string | undefined, organizationId: string): Promise<string | null> {
  if (!id) return null;
  const employee = await prisma.employee.findUnique({ where: { id }, select: { organizationId: true } });
  return employee && employee.organizationId === organizationId ? id : null;
}

// severityId comes straight from a form field too — re-check it belongs to this org's own
// IncidentSeverity list before trusting it, same reasoning as resolveResponsiblePersonId.
async function resolveSeverityId(id: string | undefined, organizationId: string): Promise<string | undefined> {
  if (!id) return undefined;
  const severity = await prisma.incidentSeverity.findUnique({ where: { id }, select: { organizationId: true } });
  return severity && severity.organizationId === organizationId ? id : undefined;
}

// Each detail-page form only submits the handful of fields it displays (status form,
// corrective-action form, etc.), so this only touches fields actually present in the
// FormData — anything not submitted is left untouched rather than nulled out.
export async function updateIncidentAction(formData: FormData) {
  const ctx = await requireOrgPermission(PERMISSIONS.INCIDENT_EDIT);
  const parsed = updateSchema.parse(Object.fromEntries(formData.entries()));

  const before = await prisma.incident.findUnique({ where: { id: parsed.incidentId } });
  assertBelongsToOrg(before, ctx.organizationId);

  const nextValues: Record<string, unknown> = {};
  if (formData.has("status") && parsed.status) nextValues.status = parsed.status;
  for (const field of TEXT_FIELDS) {
    if (formData.has(field)) nextValues[field] = parsed[field] || null;
  }
  if (formData.has("responsiblePersonId")) {
    nextValues.responsiblePersonId = await resolveResponsiblePersonId(parsed.responsiblePersonId, ctx.organizationId);
  }
  if (formData.has("severityId")) {
    const resolved = await resolveSeverityId(parsed.severityId, ctx.organizationId);
    if (resolved) nextValues.severityId = resolved;
  }
  if (formData.has("costVnd")) {
    const trimmed = parsed.costVnd?.trim();
    const n = trimmed ? Number(trimmed) : NaN;
    nextValues.costVnd = trimmed && Number.isFinite(n) ? n : null;
  }
  for (const field of DATE_FIELDS) {
    if (formData.has(field)) nextValues[field] = parsed[field] ? new Date(parsed[field] as string) : null;
  }

  await prisma.incident.update({ where: { id: parsed.incidentId }, data: nextValues });

  const changes = diffFields(
    before as unknown as Record<string, unknown>,
    nextValues,
    ["status", "immediateCause", "rootCause", "correctiveAction", "preventiveAction", "responsiblePersonId", "severityId", "costVnd", "notes"]
  );

  if (changes.length > 0) {
    await writeAuditLog({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      module: "incident",
      recordType: "Incident",
      recordId: parsed.incidentId,
      action: "update",
      changes,
    });
  }

  revalidatePath(`/incidents/${parsed.incidentId}`);
}

// categoryId comes straight from a form field too — same org-ownership re-check as severityId.
async function resolveCategoryId(id: string | undefined, organizationId: string): Promise<string | undefined> {
  if (!id) return undefined;
  const category = await prisma.incidentCategory.findUnique({ where: { id }, select: { organizationId: true } });
  return category && category.organizationId === organizationId ? id : undefined;
}

function toFiniteNumberOrNull(value: string | undefined): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

const fullUpdateSchema = z.object({
  incidentId: z.string().min(1),
  occurredAt: z.string().min(1),
  orgUnitId: z.string().optional(),
  factoryCode: z.string().optional(),
  locationDetail: z.string().max(200).optional(),
  equipment: z.string().max(200).optional(),
  employeeId: z.string().optional(),
  responsiblePersonId: z.string().optional(),
  categoryId: z.string().min(1),
  severityId: z.string().min(1),
  description: z.string().min(1),
  correctiveAction: z.string().optional(),
  costVnd: z.string().optional(),
  costRmb: z.string().optional(),
  pointsDeducted: z.string().optional(),
  injuredBodyPart: z.string().max(200).optional(),
  notes: z.string().optional(),
  status: z.enum(INCIDENT_STATUSES),
});

export type UpdateIncidentFullState = { error: string } | { success: true } | undefined;

/** Full edit — every field the create form exposes, plus status. Unlike updateIncidentAction
 *  (which only ever touches the handful of fields its own small quick-edit form submits), this
 *  always submits the whole record, so every field here is written unconditionally. */
export async function updateIncidentFullAction(_prev: UpdateIncidentFullState, formData: FormData): Promise<UpdateIncidentFullState> {
  const ctx = await requireOrgPermission(PERMISSIONS.INCIDENT_EDIT);
  const locale = await getLocale();

  const parsed = fullUpdateSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: t(locale, "incidents.new.errorGeneric") };
  const data = parsed.data;

  const before = await prisma.incident.findUnique({ where: { id: data.incidentId } });
  assertBelongsToOrg(before, ctx.organizationId);

  const categoryId = await resolveCategoryId(data.categoryId, ctx.organizationId);
  const severityId = await resolveSeverityId(data.severityId, ctx.organizationId);
  if (!categoryId || !severityId) return { error: t(locale, "incidents.new.errorGeneric") };

  const responsiblePersonId = await resolveResponsiblePersonId(data.responsiblePersonId, ctx.organizationId);

  // Only refill the name-snapshot fields when a real employee gets linked here — clearing the
  // picker just nulls employeeId, it must never wipe an existing manually-typed name snapshot.
  let employeeId: string | null = null;
  let employeeSnapshot: Record<string, string | null> = {};
  if (data.employeeId) {
    const employee = await prisma.employee.findUnique({ where: { id: data.employeeId }, include: { orgUnit: true } });
    if (employee && employee.organizationId === ctx.organizationId) {
      employeeId = employee.id;
      employeeSnapshot = {
        employeeNameSnapshot: employee.fullName,
        employeeCodeSnapshot: employee.employeeCode,
        departmentSnapshot: employee.orgUnit?.name ?? null,
        positionSnapshot: employee.position,
        shiftSnapshot: employee.shift,
      };
    }
  }

  // "工厂代码" lives inside sourceRowData (see getIncidentFactoryCode in server/incidents.ts) —
  // merge into whatever's already there rather than overwriting the whole blob, so other keys
  // an import may have set (e.g. raw source columns) survive an edit made through this form.
  const existingSourceRowData = { ...((before?.sourceRowData as Record<string, unknown> | null) ?? {}) };
  const factoryCode = data.factoryCode?.trim();
  if (factoryCode) existingSourceRowData["工厂代码"] = factoryCode;
  else delete existingSourceRowData["工厂代码"];

  const nextValues: Record<string, unknown> = {
    occurredAt: new Date(data.occurredAt),
    orgUnitId: data.orgUnitId || null,
    locationDetail: data.locationDetail || null,
    equipment: data.equipment || null,
    employeeId,
    ...employeeSnapshot,
    responsiblePersonId,
    categoryId,
    severityId,
    description: data.description,
    correctiveAction: data.correctiveAction || null,
    costVnd: toFiniteNumberOrNull(data.costVnd),
    costRmb: toFiniteNumberOrNull(data.costRmb),
    pointsDeducted: toFiniteNumberOrNull(data.pointsDeducted),
    injuredBodyPart: data.injuredBodyPart || null,
    notes: data.notes || null,
    status: data.status,
    sourceRowData: existingSourceRowData,
  };

  await prisma.incident.update({ where: { id: data.incidentId }, data: nextValues });

  const changes = diffFields(before as unknown as Record<string, unknown>, nextValues, Object.keys(nextValues));
  if (changes.length > 0) {
    await writeAuditLog({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      module: "incident",
      recordType: "Incident",
      recordId: data.incidentId,
      action: "update",
      changes,
    });
  }

  revalidatePath(`/incidents/${data.incidentId}`);
  revalidatePath("/incidents");
  return { success: true };
}

const createCapaSchema = z.object({
  incidentId: z.string().min(1),
  action: z.string().min(1),
  rootCause: z.string().optional(),
  responsiblePersonId: z.string().optional(),
  dueDate: z.string().optional(),
});

export async function createCapaFromIncidentAction(formData: FormData) {
  const ctx = await requireOrgPermission(PERMISSIONS.CAPA_CREATE);
  const parsed = createCapaSchema.parse(Object.fromEntries(formData.entries()));

  const incident = await prisma.incident.findUnique({ where: { id: parsed.incidentId } });
  assertBelongsToOrg(incident, ctx.organizationId);

  const responsiblePersonId = await resolveResponsiblePersonId(parsed.responsiblePersonId, ctx.organizationId);

  const capa = await prisma.capaItem.create({
    data: {
      organizationId: ctx.organizationId,
      sourceModule: "incident",
      sourceRecordId: parsed.incidentId,
      action: parsed.action,
      rootCause: parsed.rootCause || null,
      responsiblePersonId,
      dueDate: parsed.dueDate ? new Date(parsed.dueDate) : null,
      createdById: ctx.userId,
    },
  });

  await writeAuditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    module: "capa",
    recordType: "CapaItem",
    recordId: capa.id,
    action: "create",
  });

  revalidatePath(`/incidents/${parsed.incidentId}`);
}

export type UploadAttachmentState = { error?: string } | undefined;

export async function uploadIncidentAttachmentAction(
  _prevState: UploadAttachmentState,
  formData: FormData
): Promise<UploadAttachmentState> {
  const ctx = await requireOrgPermission(PERMISSIONS.DOCUMENT_UPLOAD);
  const incidentId = String(formData.get("incidentId"));
  const file = formData.get("file");
  const locale = await getLocale();

  const incident = await prisma.incident.findUnique({ where: { id: incidentId } });
  assertBelongsToOrg(incident, ctx.organizationId);

  if (!(file instanceof File) || file.size === 0) return { error: t(locale, "incidents.detail.uploadNoFile") };
  if (file.size > MAX_UPLOAD_SIZE_BYTES) return { error: t(locale, "incidents.detail.uploadTooLarge") };
  if (!ALLOWED_UPLOAD_TYPES.has(file.type)) return { error: t(locale, "incidents.detail.uploadTypeNotAllowed") };

  if (file.type.startsWith("image/")) {
    const photoCount = await prisma.document.count({
      where: { organizationId: ctx.organizationId, module: "incident", recordId: incidentId, fileType: { startsWith: "image/" } },
    });
    if (photoCount >= MAX_INCIDENT_PHOTOS) {
      return { error: t(locale, "incidents.detail.uploadPhotoLimit", { max: MAX_INCIDENT_PHOTOS }) };
    }
  }

  let buffer = Buffer.from(await file.arrayBuffer());
  // Incident photos always render as a square tile, so crop server-side at upload time
  // (attention-based crop keeps the most visually interesting region) rather than only
  // relying on CSS object-fit — the stored file itself is square.
  if (file.type.startsWith("image/")) {
    buffer = await sharp(buffer)
      .resize(1024, 1024, { fit: "cover", position: sharp.strategy.attention })
      .toBuffer();
  }

  const { storagePath } = await storageService.save({
    organizationId: ctx.organizationId,
    module: "incident",
    recordId: incidentId,
    fileName: file.name,
    buffer,
  });

  const doc = await prisma.document.create({
    data: {
      organizationId: ctx.organizationId,
      module: "incident",
      recordId: incidentId,
      fileName: file.name,
      fileType: file.type,
      sizeBytes: buffer.length,
      storageProvider: "local",
      storagePath,
      uploadedById: ctx.userId,
    },
  });

  await writeAuditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    module: "incident",
    recordType: "Document",
    recordId: doc.id,
    action: "create",
  });

  revalidatePath(`/incidents/${incidentId}`);
  return undefined;
}

export async function deleteIncidentAction(incidentId: string) {
  const ctx = await requireOrgPermission(PERMISSIONS.INCIDENT_DELETE);

  const incident = await prisma.incident.findUnique({ where: { id: incidentId } });
  assertBelongsToOrg(incident, ctx.organizationId);

  const documents = await prisma.document.findMany({
    where: { organizationId: ctx.organizationId, module: "incident", recordId: incidentId },
  });
  for (const doc of documents) {
    await storageService.delete(doc.storagePath).catch(() => {});
  }

  await prisma.$transaction([
    prisma.capaItem.deleteMany({ where: { organizationId: ctx.organizationId, sourceModule: "incident", sourceRecordId: incidentId } }),
    prisma.document.deleteMany({ where: { organizationId: ctx.organizationId, module: "incident", recordId: incidentId } }),
    prisma.incident.delete({ where: { id: incidentId } }),
  ]);

  await writeAuditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    module: "incident",
    recordType: "Incident",
    recordId: incidentId,
    action: "delete",
    changes: [{ field: "incidentNumber", oldValue: incident!.incidentNumber, newValue: null }],
  });

  revalidatePath("/incidents");
  revalidatePath("/capa");
}

export async function deleteIncidentAttachmentAction(formData: FormData) {
  const ctx = await requireOrgPermission(PERMISSIONS.DOCUMENT_DELETE);
  const documentId = String(formData.get("documentId"));
  const incidentId = String(formData.get("incidentId"));

  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  assertBelongsToOrg(doc, ctx.organizationId);

  await storageService.delete(doc!.storagePath);
  await prisma.document.delete({ where: { id: documentId } });

  await writeAuditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    module: "incident",
    recordType: "Document",
    recordId: documentId,
    action: "delete",
  });

  revalidatePath(`/incidents/${incidentId}`);
}
