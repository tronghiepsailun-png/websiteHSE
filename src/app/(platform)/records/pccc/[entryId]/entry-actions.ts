"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrgPermission } from "@/server/api-guard";
import { PERMISSIONS } from "@/server/permissions";
import { assertBelongsToOrg } from "@/server/org-context";
import { writeAuditLog } from "@/server/audit";

const schema = z.object({
  entryId: z.string().min(1),
  responsiblePerson: z.string().optional(),
});

/** The only genuinely stored, editable field on "Trạng thái hiện tại" — dataStatus/expiryStatus
 *  are derived from dates elsewhere on the page (slot uploads, version entries), not their own
 *  editable values. */
export async function updateRecordEntryStatusAction(formData: FormData) {
  const ctx = await requireOrgPermission(PERMISSIONS.RECORDS_EDIT);
  const parsed = schema.parse(Object.fromEntries(formData.entries()));

  const entry = await prisma.recordEntry.findUnique({ where: { id: parsed.entryId } });
  assertBelongsToOrg(entry, ctx.organizationId);

  await prisma.recordEntry.update({
    where: { id: parsed.entryId },
    data: { responsiblePerson: parsed.responsiblePerson?.trim() || null },
  });

  await writeAuditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    module: "records",
    recordType: "RecordEntry",
    recordId: parsed.entryId,
    action: "update",
    changes: [{ field: "responsiblePerson", oldValue: entry?.responsiblePerson ?? null, newValue: parsed.responsiblePerson?.trim() || null }],
  });

  revalidatePath(`/records/pccc/${parsed.entryId}`);
  revalidatePath("/records/pccc/list");
}
