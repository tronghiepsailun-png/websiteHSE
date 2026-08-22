"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOrgPermission } from "@/server/api-guard";
import { PERMISSIONS } from "@/server/permissions";
import { prisma } from "@/lib/prisma";
import { assertBelongsToOrg } from "@/server/org-context";
import { createRecordType, setRecordTypeActive, applyRecordTypeToSites } from "@/server/records-catalog";
import { writeAuditLog } from "@/server/audit";

// A crafted request can bypass the form's type="number" input, so a non-numeric string must
// not reach Prisma as NaN — the Int column write would throw instead of failing validation.
function toFiniteNumberOrNull(value: string | undefined): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// Every mutation here changes data the /records/pccc overview and /records/pccc/list
// dashboards aggregate (KPI counts, expiry status), so both must be revalidated alongside
// the catalog page itself.
function revalidateRecordsPaths() {
  revalidatePath("/records/pccc/catalog");
  revalidatePath("/records/pccc");
  revalidatePath("/records/pccc/list");
}

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
    cycleMonths: toFiniteNumberOrNull(parsed.cycleMonths),
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

  revalidateRecordsPaths();
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

  revalidateRecordsPaths();
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

  revalidateRecordsPaths();
  redirect(`/records/pccc/catalog?applied=${result.created}`);
}
