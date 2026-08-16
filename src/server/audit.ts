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
