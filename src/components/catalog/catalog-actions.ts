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

/** What each module that owns editable dropdown lists needs: who may edit them, which lists
 *  exist, which record column (if any) stores an entry's name as plain text — so a rename can
 *  rewrite it — and which pages to refresh. */
const MODULES: Record<string, { permission: string; kinds: string[]; textColumn: Record<string, string>; paths: string[] }> = {
  capa: {
    permission: PERMISSIONS.CAPA_EDIT,
    kinds: ["area", "dept"],
    textColumn: { area: "area", dept: "responsibleDept" },
    paths: ["/capa/catalog", "/capa"],
  },
  forms: {
    permission: PERMISSIONS.FORMS_EDIT,
    kinds: ["category"],
    textColumn: {},
    paths: ["/form-library/categories", "/form-library"],
  },
};

const nameSchema = z.object({
  nameVi: z.string().trim().min(1).max(200),
  nameZh: z.string().trim().max(200).optional(),
});

async function authorize(module: string) {
  const cfg = MODULES[module];
  if (!cfg) return null;
  const ctx = await requireOrgPermission(cfg.permission);
  return { cfg, ctx };
}

async function loadOwned(id: string) {
  const row = await prisma.catalogItem.findUnique({ where: { id } });
  if (!row) return null;
  const auth = await authorize(row.module);
  if (!auth || row.organizationId !== auth.ctx.organizationId) return null;
  return { row, ...auth };
}

function revalidate(paths: string[]) {
  for (const p of paths) revalidatePath(p);
}

async function audit(organizationId: string, userId: string, module: string, recordId: string, action: "create" | "update" | "delete") {
  await writeAuditLog({ organizationId, userId, module, recordType: "CatalogItem", recordId, action });
}

async function isDuplicate(organizationId: string, module: string, kind: string, nameVi: string, exceptId?: string) {
  const dup = await prisma.catalogItem.findFirst({
    where: { organizationId, module, kind, nameVi, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  });
  return dup !== null;
}

export async function createCatalogItemAction(module: string, kind: string, input: { nameVi: string; nameZh?: string }): Promise<CatalogActionResult> {
  const auth = await authorize(module);
  const locale = await getLocale();
  const parsed = nameSchema.safeParse(input);
  if (!auth || !auth.cfg.kinds.includes(kind) || !parsed.success) return { error: t(locale, "capa.catalog.errorInvalid") };
  const { ctx, cfg } = auth;
  if (await isDuplicate(ctx.organizationId, module, kind, parsed.data.nameVi)) return { error: t(locale, "capa.catalog.errorDuplicate") };

  const last = await prisma.catalogItem.findFirst({
    where: { organizationId: ctx.organizationId, module, kind },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  const created = await prisma.catalogItem.create({
    data: {
      organizationId: ctx.organizationId,
      module,
      kind,
      nameVi: parsed.data.nameVi,
      nameZh: parsed.data.nameZh || null,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });
  await audit(ctx.organizationId, ctx.userId, module, created.id, "create");
  revalidate(cfg.paths);
  return { success: true };
}

/** Renaming keeps every existing record pointing at the entry where records store its name as
 *  plain text (CAPA): they're rewritten to the new Vietnamese name in the same step. */
export async function updateCatalogItemAction(id: string, input: { nameVi: string; nameZh?: string }): Promise<CatalogActionResult> {
  const locale = await getLocale();
  const parsed = nameSchema.safeParse(input);
  const owned = await loadOwned(id);
  if (!owned || !parsed.success) return { error: t(locale, "capa.catalog.errorInvalid") };
  const { row, ctx, cfg } = owned;
  if (await isDuplicate(ctx.organizationId, row.module, row.kind, parsed.data.nameVi, id)) return { error: t(locale, "capa.catalog.errorDuplicate") };

  const oldNames = [row.nameVi, row.nameZh].filter((n): n is string => Boolean(n));
  const column = cfg.textColumn[row.kind];
  const renamed = parsed.data.nameVi !== row.nameVi || (parsed.data.nameZh || null) !== row.nameZh;

  await prisma.$transaction([
    prisma.catalogItem.update({ where: { id }, data: { nameVi: parsed.data.nameVi, nameZh: parsed.data.nameZh || null } }),
    ...(column && renamed
      ? [prisma.capaItem.updateMany({ where: { organizationId: ctx.organizationId, [column]: { in: oldNames } }, data: { [column]: parsed.data.nameVi } })]
      : []),
  ]);
  await audit(ctx.organizationId, ctx.userId, row.module, id, "update");
  revalidate(cfg.paths);
  return { success: true };
}

export async function toggleCatalogItemAction(id: string, isActive: boolean): Promise<CatalogActionResult> {
  const locale = await getLocale();
  const owned = await loadOwned(id);
  if (!owned) return { error: t(locale, "capa.catalog.errorInvalid") };
  await prisma.catalogItem.update({ where: { id }, data: { isActive } });
  await audit(owned.ctx.organizationId, owned.ctx.userId, owned.row.module, id, "update");
  revalidate(owned.cfg.paths);
  return { success: true };
}

export async function moveCatalogItemAction(id: string, direction: "up" | "down"): Promise<CatalogActionResult> {
  const locale = await getLocale();
  const owned = await loadOwned(id);
  if (!owned) return { error: t(locale, "capa.catalog.errorInvalid") };
  const { row, ctx, cfg } = owned;

  const siblings = await prisma.catalogItem.findMany({
    where: { organizationId: ctx.organizationId, module: row.module, kind: row.kind },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  const from = siblings.findIndex((s) => s.id === id);
  const to = direction === "up" ? from - 1 : from + 1;
  if (from < 0 || to < 0 || to >= siblings.length) return { success: true };

  const order = siblings.map((s) => s.id);
  [order[from], order[to]] = [order[to], order[from]];
  await prisma.$transaction(order.map((itemId, index) => prisma.catalogItem.update({ where: { id: itemId }, data: { sortOrder: index } })));
  revalidate(cfg.paths);
  return { success: true };
}

/** Existing CAPA rows keep the text they were saved with (shown as-is once no entry matches);
 *  a form-library category that still holds forms cannot be deleted. */
export async function deleteCatalogItemAction(id: string): Promise<CatalogActionResult> {
  const locale = await getLocale();
  const owned = await loadOwned(id);
  if (!owned) return { error: t(locale, "capa.catalog.errorInvalid") };
  const { row, ctx, cfg } = owned;

  if (row.module === "forms") {
    const inUse = await prisma.formTemplate.count({ where: { organizationId: ctx.organizationId, categoryId: id } });
    if (inUse > 0) return { error: t(locale, "forms.catalog.errorInUse", { n: inUse }) };
  }

  await prisma.catalogItem.delete({ where: { id } });
  await audit(ctx.organizationId, ctx.userId, row.module, id, "delete");
  revalidate(cfg.paths);
  return { success: true };
}
