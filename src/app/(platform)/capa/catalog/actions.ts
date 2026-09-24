"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrgPermission } from "@/server/api-guard";
import { PERMISSIONS } from "@/server/permissions";
import { writeAuditLog } from "@/server/audit";
import { getLocale } from "@/lib/i18n/get-locale.server";
import { t } from "@/lib/i18n/translate";

export type CatalogActionResult = { error: string } | { success: true };

const KIND_COLUMN = { area: "area", dept: "responsibleDept" } as const;
type Kind = keyof typeof KIND_COLUMN;

const kindSchema = z.enum(["area", "dept"]);
const nameSchema = z.object({
  nameVi: z.string().trim().min(1).max(200),
  nameZh: z.string().trim().max(200).optional(),
});

function revalidate() {
  revalidatePath("/capa/catalog");
  revalidatePath("/capa");
}

async function audit(ctx: { organizationId: string; userId: string }, recordId: string, action: "create" | "update" | "delete") {
  await writeAuditLog({ organizationId: ctx.organizationId, userId: ctx.userId, module: "capa", recordType: "CatalogItem", recordId, action });
}

async function loadOwned(id: string, organizationId: string) {
  const row = await prisma.catalogItem.findUnique({ where: { id } });
  if (!row || row.organizationId !== organizationId || row.module !== "capa") return null;
  return row;
}

async function isDuplicate(organizationId: string, kind: string, nameVi: string, exceptId?: string) {
  const dup = await prisma.catalogItem.findFirst({
    where: { organizationId, module: "capa", kind, nameVi, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  });
  return dup !== null;
}

export async function createCatalogItemAction(kindInput: string, input: { nameVi: string; nameZh?: string }): Promise<CatalogActionResult> {
  const ctx = await requireOrgPermission(PERMISSIONS.CAPA_EDIT);
  const locale = await getLocale();
  const kind = kindSchema.safeParse(kindInput);
  const parsed = nameSchema.safeParse(input);
  if (!kind.success || !parsed.success) return { error: t(locale, "capa.catalog.errorInvalid") };
  if (await isDuplicate(ctx.organizationId, kind.data, parsed.data.nameVi)) return { error: t(locale, "capa.catalog.errorDuplicate") };

  const last = await prisma.catalogItem.findFirst({
    where: { organizationId: ctx.organizationId, module: "capa", kind: kind.data },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  const created = await prisma.catalogItem.create({
    data: {
      organizationId: ctx.organizationId,
      module: "capa",
      kind: kind.data,
      nameVi: parsed.data.nameVi,
      nameZh: parsed.data.nameZh || null,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });
  await audit(ctx, created.id, "create");
  revalidate();
  return { success: true };
}

/** Renaming keeps every existing CAPA row pointing at the entry: rows store the entry's name as
 *  plain text, so they're rewritten to the new Vietnamese name in the same step. */
export async function updateCatalogItemAction(id: string, input: { nameVi: string; nameZh?: string }): Promise<CatalogActionResult> {
  const ctx = await requireOrgPermission(PERMISSIONS.CAPA_EDIT);
  const locale = await getLocale();
  const parsed = nameSchema.safeParse(input);
  if (!parsed.success) return { error: t(locale, "capa.catalog.errorInvalid") };
  const row = await loadOwned(id, ctx.organizationId);
  if (!row) return { error: t(locale, "capa.catalog.errorInvalid") };
  if (await isDuplicate(ctx.organizationId, row.kind, parsed.data.nameVi, id)) return { error: t(locale, "capa.catalog.errorDuplicate") };

  const oldNames = [row.nameVi, row.nameZh].filter((n): n is string => Boolean(n));
  const column = KIND_COLUMN[row.kind as Kind];

  await prisma.$transaction([
    prisma.catalogItem.update({ where: { id }, data: { nameVi: parsed.data.nameVi, nameZh: parsed.data.nameZh || null } }),
    ...(column && (parsed.data.nameVi !== row.nameVi || (parsed.data.nameZh || null) !== row.nameZh)
      ? [prisma.capaItem.updateMany({ where: { organizationId: ctx.organizationId, [column]: { in: oldNames } }, data: { [column]: parsed.data.nameVi } })]
      : []),
  ]);
  await audit(ctx, id, "update");
  revalidate();
  return { success: true };
}

export async function toggleCatalogItemAction(id: string, isActive: boolean): Promise<CatalogActionResult> {
  const ctx = await requireOrgPermission(PERMISSIONS.CAPA_EDIT);
  const locale = await getLocale();
  const row = await loadOwned(id, ctx.organizationId);
  if (!row) return { error: t(locale, "capa.catalog.errorInvalid") };
  await prisma.catalogItem.update({ where: { id }, data: { isActive } });
  await audit(ctx, id, "update");
  revalidate();
  return { success: true };
}

export async function moveCatalogItemAction(id: string, direction: "up" | "down"): Promise<CatalogActionResult> {
  const ctx = await requireOrgPermission(PERMISSIONS.CAPA_EDIT);
  const locale = await getLocale();
  const row = await loadOwned(id, ctx.organizationId);
  if (!row) return { error: t(locale, "capa.catalog.errorInvalid") };

  const siblings = await prisma.catalogItem.findMany({
    where: { organizationId: ctx.organizationId, module: "capa", kind: row.kind },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  const from = siblings.findIndex((s) => s.id === id);
  const to = direction === "up" ? from - 1 : from + 1;
  if (from < 0 || to < 0 || to >= siblings.length) return { success: true };

  const order = siblings.map((s) => s.id);
  [order[from], order[to]] = [order[to], order[from]];
  await prisma.$transaction(order.map((itemId, index) => prisma.catalogItem.update({ where: { id: itemId }, data: { sortOrder: index } })));
  revalidate();
  return { success: true };
}

/** Existing CAPA rows keep the text they were saved with (shown as-is once no entry matches). */
export async function deleteCatalogItemAction(id: string): Promise<CatalogActionResult> {
  const ctx = await requireOrgPermission(PERMISSIONS.CAPA_EDIT);
  const locale = await getLocale();
  const row = await loadOwned(id, ctx.organizationId);
  if (!row) return { error: t(locale, "capa.catalog.errorInvalid") };
  await prisma.catalogItem.delete({ where: { id } });
  await audit(ctx, id, "delete");
  revalidate();
  return { success: true };
}
