import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/server/errors";

// Re-exported for existing server-side callers — the canonical definitions live in
// lib/work-plan-constants.ts so client components can import them without pulling this
// module's `prisma` import (and everything downstream of it) into the browser bundle.
export { WORK_PLAN_STATUSES, type WorkPlanStatus } from "@/lib/work-plan-constants";

/** A phase-grouping key derived purely from item order — consecutive items sharing the same
 *  `phase` text render under one banner. Items are always fetched pre-ordered by sortOrder,
 *  so this only ever needs to compare each item to its immediate predecessor. */
export function groupByPhase<T extends { phase: string | null }>(items: T[]) {
  const groups: { phase: string | null; items: T[] }[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.phase === item.phase) last.items.push(item);
    else groups.push({ phase: item.phase, items: [item] });
  }
  return groups;
}

export async function listWorkPlanDocuments(organizationId: string) {
  return prisma.workPlanDocument.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getWorkPlanDocumentById(organizationId: string, id: string) {
  const doc = await prisma.workPlanDocument.findUnique({ where: { id } });
  if (!doc || doc.organizationId !== organizationId) throw new NotFoundError("Work plan document not found");
  return doc;
}

/** The most recently created document for this org, or null if none exist yet. */
export async function getDefaultWorkPlanDocument(organizationId: string) {
  return prisma.workPlanDocument.findFirst({ where: { organizationId }, orderBy: { createdAt: "desc" } });
}

export async function listWorkPlanItems(documentId: string) {
  return prisma.workPlanItem.findMany({ where: { documentId }, orderBy: { sortOrder: "asc" } });
}

export function isWorkPlanItemOverdue(item: { status: string; endDate: Date | null }) {
  if (!item.endDate) return false;
  if (item.status === "completed") return false;
  return item.endDate.getTime() < Date.now();
}

export function getWorkPlanStats(items: { status: string; endDate: Date | null; progressPercent: number }[]) {
  const total = items.length;
  const overdue = items.filter((i) => isWorkPlanItemOverdue(i)).length;
  const avgProgress = total === 0 ? 0 : Math.round(items.reduce((sum, i) => sum + i.progressPercent, 0) / total);
  return { total, overdue, avgProgress };
}

export async function getNextSortOrder(documentId: string) {
  const last = await prisma.workPlanItem.findFirst({ where: { documentId }, orderBy: { sortOrder: "desc" } });
  return (last?.sortOrder ?? -1) + 1;
}
