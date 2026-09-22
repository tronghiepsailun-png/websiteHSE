import { prisma } from "@/lib/prisma";

type FieldChange = { field: string; oldValue: unknown; newValue: unknown };

export async function writeAuditLog(params: {
  organizationId: string;
  userId: string | null;
  module: string;
  recordType: string;
  recordId: string;
  action: "create" | "update" | "delete";
  changes?: FieldChange[];
}) {
  const { organizationId, userId, module, recordType, recordId, action, changes } = params;

  if (!changes || changes.length === 0) {
    await prisma.auditLog.create({
      data: { organizationId, userId, module, recordType, recordId, action },
    });
    return;
  }

  await prisma.auditLog.createMany({
    data: changes.map((c) => ({
      organizationId,
      userId,
      module,
      recordType,
      recordId,
      action,
      fieldName: c.field,
      oldValue: c.oldValue === null || c.oldValue === undefined ? null : String(c.oldValue),
      newValue: c.newValue === null || c.newValue === undefined ? null : String(c.newValue),
    })),
  });
}

export type AuditEntry = {
  id: string;
  action: string;
  fieldName: string | null;
  oldValue: string | null;
  newValue: string | null;
  createdAt: Date;
  userName: string | null;
};

/** One record's change history, newest first. Capped because a heavily edited record can
 *  accumulate one row per changed field per save, and the timeline is a read-only sidebar.
 *  `excludeFields` drops internal bookkeeping columns (import payloads, snapshots) that carry
 *  no meaning for a human reading the history. */
export async function listAuditLogForRecord(
  organizationId: string,
  module: string,
  recordId: string,
  { limit = 50, excludeFields = [] }: { limit?: number; excludeFields?: string[] } = {}
): Promise<AuditEntry[]> {
  const rows = await prisma.auditLog.findMany({
    where: {
      organizationId,
      module,
      recordId,
      ...(excludeFields.length > 0 ? { OR: [{ fieldName: null }, { fieldName: { notIn: excludeFields } }] } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      action: true,
      fieldName: true,
      oldValue: true,
      newValue: true,
      createdAt: true,
      user: { select: { name: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    fieldName: row.fieldName,
    oldValue: row.oldValue,
    newValue: row.newValue,
    createdAt: row.createdAt,
    userName: row.user?.name ?? null,
  }));
}

/** Compares `fields` between two objects and returns only what actually changed. */
export function diffFields<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
  fields: (keyof T & string)[]
): FieldChange[] {
  const changes: FieldChange[] = [];
  for (const field of fields) {
    if (field in after && after[field] !== before[field]) {
      changes.push({ field, oldValue: before[field], newValue: after[field] });
    }
  }
  return changes;
}
