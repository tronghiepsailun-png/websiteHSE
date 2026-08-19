"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrgPermission } from "@/server/api-guard";
import { PERMISSIONS } from "@/server/permissions";
import { writeAuditLog, diffFields } from "@/server/audit";
import { assertBelongsToOrg } from "@/server/org-context";
import { storageService, ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_SIZE_BYTES } from "@/server/storage";
import { INCIDENT_STATUSES } from "@/server/incidents";

const updateSchema = z.object({
  incidentId: z.string().min(1),
  status: z.enum(INCIDENT_STATUSES).optional(),
  immediateCause: z.string().optional(),
  rootCause: z.string().optional(),
  correctiveAction: z.string().optional(),
  preventiveAction: z.string().optional(),
  responsiblePersonId: z.string().optional(),
  dueDate: z.string().optional(),
  completionDate: z.string().optional(),
  notes: z.string().optional(),
});

const TEXT_FIELDS = ["immediateCause", "rootCause", "correctiveAction", "preventiveAction", "responsiblePersonId", "notes"] as const;
const DATE_FIELDS = ["dueDate", "completionDate"] as const;

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
  for (const field of DATE_FIELDS) {
    if (formData.has(field)) nextValues[field] = parsed[field] ? new Date(parsed[field] as string) : null;
  }

  await prisma.incident.update({ where: { id: parsed.incidentId }, data: nextValues });

  const changes = diffFields(
    before as unknown as Record<string, unknown>,
    nextValues,
    ["status", "immediateCause", "rootCause", "correctiveAction", "preventiveAction", "responsiblePersonId", "notes"]
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

  const capa = await prisma.capaItem.create({
    data: {
      organizationId: ctx.organizationId,
      sourceModule: "incident",
      sourceRecordId: parsed.incidentId,
      action: parsed.action,
      rootCause: parsed.rootCause || null,
      responsiblePersonId: parsed.responsiblePersonId || null,
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

export async function uploadIncidentAttachmentAction(formData: FormData) {
  const ctx = await requireOrgPermission(PERMISSIONS.DOCUMENT_UPLOAD);
  const incidentId = String(formData.get("incidentId"));
  const file = formData.get("file");

  const incident = await prisma.incident.findUnique({ where: { id: incidentId } });
  assertBelongsToOrg(incident, ctx.organizationId);

  if (!(file instanceof File) || file.size === 0) return;
  if (file.size > MAX_UPLOAD_SIZE_BYTES) throw new Error("File is too large");
  if (!ALLOWED_UPLOAD_TYPES.has(file.type)) throw new Error("File type not allowed");

  const buffer = Buffer.from(await file.arrayBuffer());
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
      sizeBytes: file.size,
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
