"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOrgPermission } from "@/server/api-guard";
import { PERMISSIONS } from "@/server/permissions";
import { prisma } from "@/lib/prisma";
import { assertBelongsToOrg } from "@/server/org-context";
import { createRecordType, setRecordTypeActive, applyRecordTypeToSites } from "@/server/records-catalog";
import { writeAuditLog } from "@/server/audit";

const createSchema = z.object({
  groupId: z.string().min(1),
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(200),
  legalBasis: z.string().optional(),
  frequencyLabel: z.string().optional(),
  cycleMonths: z.string().optional(),
  responsibleUnit: z.string().optional(),
  sharedAcrossSites: z.string().optional(),
});

export async function createRecordTypeAction(formData: FormData) {
  const ctx = await requireOrgPermission(PERMISSIONS.RECORDS_MANAGE);
  const parsed = createSchema.parse(Object.fromEntries(formData.entries()));

  const group = await prisma.recordGroup.findUnique({ where: { id: parsed.groupId }, include: { domain: true } });
  assertBelongsToOrg(group?.domain ?? null, ctx.organizationId);

  const created = await createRecordType({
    groupId: parsed.groupId,
    code: parsed.code.trim(),
    name: parsed.name.trim(),
    legalBasis: parsed.legalBasis?.trim() || null,
    frequencyLabel: parsed.frequencyLabel?.trim() || null,
    cycleMonths: parsed.cycleMonths ? Number(parsed.cycleMonths) : null,
    responsibleUnit: parsed.responsibleUnit?.trim() || null,
    sharedAcrossSites: parsed.sharedAcrossSites === "on",
  });

  await writeAuditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    module: "records",
    recordType: "RecordType",
    recordId: created.id,
    action: "create",
  });

  redirect("/records/pccc/catalog");
}

export async function toggleRecordTypeActiveAction(formData: FormData) {
  const ctx = await requireOrgPermission(PERMISSIONS.RECORDS_MANAGE);
  const id = String(formData.get("id"));
  const nextIsActive = formData.get("isActive") === "true";

  const recordType = await prisma.recordType.findUnique({ where: { id }, include: { group: { include: { domain: true } } } });
  assertBelongsToOrg(recordType?.group.domain ?? null, ctx.organizationId);

  await setRecordTypeActive(id, nextIsActive);

  await writeAuditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    module: "records",
    recordType: "RecordType",
    recordId: id,
    action: "update",
    changes: [{ field: "isActive", oldValue: String(!nextIsActive), newValue: String(nextIsActive) }],
  });

  redirect("/records/pccc/catalog");
}

export async function applyRecordTypeToSitesAction(formData: FormData) {
  const ctx = await requireOrgPermission(PERMISSIONS.RECORDS_MANAGE);
  const recordTypeId = String(formData.get("recordTypeId"));
  const orgUnitIds = formData.getAll("orgUnitIds").map(String);

  const recordType = await prisma.recordType.findUnique({ where: { id: recordTypeId }, include: { group: { include: { domain: true } } } });
  assertBelongsToOrg(recordType?.group.domain ?? null, ctx.organizationId);

  const result = await applyRecordTypeToSites(ctx.organizationId, recordTypeId, orgUnitIds);

  await writeAuditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    module: "records",
    recordType: "RecordEntry",
    recordId: recordTypeId,
    action: "create",
    changes: [{ field: "applyToSites", oldValue: null, newValue: `${result.created} created` }],
  });

  redirect(`/records/pccc/catalog?applied=${result.created}`);
}
