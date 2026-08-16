import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/server/errors";

export const CAPA_STATUSES = ["open", "in_progress", "completed", "overdue", "closed"] as const;

/** Polymorphic: works for incident CAPA today, and inspection/audit/risk/violation CAPA later
 *  without a schema change — only sourceModule gains a new value. */
export async function listCapaForRecord(organizationId: string, sourceModule: string, sourceRecordId: string) {
  return prisma.capaItem.findMany({
    where: { organizationId, sourceModule, sourceRecordId },
    include: { responsiblePerson: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function listCapaForOrg(
  organizationId: string,
  filters: { status?: string; search?: string } = {}
) {
  return prisma.capaItem.findMany({
    where: {
      organizationId,
      status: filters.status || undefined,
      ...(filters.search ? { action: { contains: filters.search } } : {}),
    },
    include: { responsiblePerson: true },
    orderBy: { dueDate: "asc" },
  });
}

export async function getCapaSummary(organizationId: string) {
  const now = new Date();
  const [total, open, overdue, completed] = await Promise.all([
    prisma.capaItem.count({ where: { organizationId } }),
    prisma.capaItem.count({ where: { organizationId, status: { notIn: ["completed", "closed"] } } }),
    prisma.capaItem.count({
      where: { organizationId, status: { notIn: ["completed", "closed"] }, dueDate: { lt: now } },
    }),
    prisma.capaItem.count({ where: { organizationId, status: "completed" } }),
  ]);
  return { total, open, overdue, completed };
}

export async function getCapaById(organizationId: string, id: string) {
  const capa = await prisma.capaItem.findUnique({ where: { id }, include: { responsiblePerson: true } });
  if (!capa || capa.organizationId !== organizationId) throw new NotFoundError("CAPA not found");
  return capa;
}

/** true when a CAPA item is functionally overdue regardless of its stored status label. */
export function isCapaOverdue(capa: { status: string; dueDate: Date | null }) {
  if (!capa.dueDate) return false;
  if (capa.status === "completed" || capa.status === "closed") return false;
  return capa.dueDate.getTime() < Date.now();
}
