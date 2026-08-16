"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireOrgContext } from "@/server/org-context";
import { requirePermission } from "@/server/rbac";
import { PERMISSIONS } from "@/server/permissions";
import { writeAuditLog, diffFields } from "@/server/audit";
import { assertBelongsToOrg } from "@/server/org-context";
import { CAPA_STATUSES } from "@/server/capa";

function permissionForStatus(status: string) {
  if (status === "closed") return PERMISSIONS.CAPA_CLOSE;
  if (status === "completed") return PERMISSIONS.CAPA_APPROVE;
  return PERMISSIONS.CAPA_EDIT;
}

export async function updateCapaStatusAction(formData: FormData) {
  const ctx = await requireOrgContext();
  const capaId = String(formData.get("capaId"));
  const nextStatus = String(formData.get("status"));

  if (!CAPA_STATUSES.includes(nextStatus as (typeof CAPA_STATUSES)[number])) {
    throw new Error("Invalid status");
  }

  await requirePermission(ctx.userId, ctx.organizationId, ctx.isPlatformAdmin, permissionForStatus(nextStatus));

  const before = await prisma.capaItem.findUnique({ where: { id: capaId } });
  assertBelongsToOrg(before, ctx.organizationId);

  const completionDate = nextStatus === "completed" || nextStatus === "closed" ? new Date() : before!.completionDate;

  await prisma.capaItem.update({ where: { id: capaId }, data: { status: nextStatus, completionDate } });

  const changes = diffFields(before as unknown as Record<string, unknown>, { status: nextStatus }, ["status"]);
  if (changes.length > 0) {
    await writeAuditLog({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      module: "capa",
      recordType: "CapaItem",
      recordId: capaId,
      action: "update",
      changes,
    });
  }

  revalidatePath("/capa");
  revalidatePath(`/incidents/${before!.sourceRecordId}`);
}
