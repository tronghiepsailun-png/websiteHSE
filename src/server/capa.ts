import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/server/errors";

export const CAPA_STATUSES = ["open", "in_progress", "completed", "overdue", "closed"] as const;

export { CAPA_CLASSIFICATIONS, type CapaClassification } from "@/lib/capa-constants";

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
  filters: { status?: string; classification?: string; search?: string } = {}
) {
  return prisma.capaItem.findMany({
    where: {
      organizationId,
      status: filters.status || undefined,
      classification: filters.classification || undefined,
      ...(filters.search ? { action: { contains: filters.search } } : {}),
    },
    include: { responsiblePerson: true },
    orderBy: { createdAt: "desc" },
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

/** Raw rows for the "issues by department" charts — grouping/localizing the department
 *  name happens in the page (it needs the SafetyWorkshop catalog to normalize a value that
 *  may have been saved in either Vietnamese or Chinese). */
export async function getCapaDeptBreakdown(organizationId: string) {
  return prisma.capaItem.findMany({
    where: { organizationId },
    select: { responsibleDept: true, status: true, classification: true },
  });
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

/** Số ngày chưa xử lý — counts from the day the issue was found until it was confirmed done
 *  (or until now, while still open). Blank once resolved, same as the org's own sheet only
 *  ever fills this in for rows still pending. */
export function daysUnresolved(capa: { status: string; discoveredDate: Date | null; createdAt: Date; completionDate: Date | null }): number | null {
  if (capa.status === "completed" || capa.status === "closed") return null;
  const start = capa.discoveredDate ?? capa.createdAt;
  return Math.max(0, Math.floor((Date.now() - start.getTime()) / 86_400_000));
}

export type CapaPhotos = { before: { id: string; fileName: string } | null; after: { id: string; fileName: string } | null };

/** CAPA before/after photos live in the shared polymorphic Document table (module="capa"),
 *  tagged "before"/"after" — batched into one query for a list of CAPA ids rather than N+1. */
export async function getCapaPhotosMap(organizationId: string, capaIds: string[]): Promise<Map<string, CapaPhotos>> {
  if (capaIds.length === 0) return new Map();
  const docs = await prisma.document.findMany({
    where: { organizationId, module: "capa", recordId: { in: capaIds }, tag: { in: ["before", "after"] } },
    orderBy: { uploadedAt: "desc" },
    select: { id: true, fileName: true, recordId: true, tag: true },
  });
  const map = new Map<string, CapaPhotos>();
  for (const id of capaIds) map.set(id, { before: null, after: null });
  for (const doc of docs) {
    const entry = map.get(doc.recordId);
    if (!entry) continue;
    if (doc.tag === "before" && !entry.before) entry.before = { id: doc.id, fileName: doc.fileName };
    if (doc.tag === "after" && !entry.after) entry.after = { id: doc.id, fileName: doc.fileName };
  }
  return map;
}

export async function getCapaPhotos(organizationId: string, capaId: string): Promise<CapaPhotos> {
  const map = await getCapaPhotosMap(organizationId, [capaId]);
  return map.get(capaId) ?? { before: null, after: null };
}
