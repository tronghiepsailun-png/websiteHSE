import { prisma } from "@/lib/prisma";
import type { Locale } from "@/lib/i18n/translate";

export type CatalogItemRow = { id: string; nameVi: string; nameZh: string | null; sortOrder: number; isActive: boolean };

/** Every dropdown a module lets the org edit, keyed by module then kind. */
export const CATALOG_KINDS = {
  capa: ["area", "dept"],
} as const;

export type CatalogModule = keyof typeof CATALOG_KINDS;

export function localizedCatalogName(item: { nameVi: string; nameZh: string | null }, locale: Locale) {
  return locale === "zh" ? item.nameZh?.trim() || item.nameVi : item.nameVi;
}

export async function listCatalogItems(organizationId: string, module: string, kind: string): Promise<CatalogItemRow[]> {
  return prisma.catalogItem.findMany({
    where: { organizationId, module, kind },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, nameVi: true, nameZh: true, sortOrder: true, isActive: true },
  });
}

/** Rows are stored as plain text — usually the Vietnamese name (what the dropdown submits), but
 *  older rows may hold the Chinese name — so a stored value matches an item by EITHER name and
 *  is then shown in the viewer's language. A value with no matching item (item since deleted)
 *  is shown as typed rather than blanked. */
export function makeCatalogResolver(items: { nameVi: string; nameZh: string | null }[], locale: Locale) {
  const byName = new Map<string, { nameVi: string; nameZh: string | null }>();
  for (const item of items) {
    byName.set(item.nameVi, item);
    if (item.nameZh) byName.set(item.nameZh, item);
  }
  return (value: string | null): string | null => {
    if (!value) return value;
    const match = byName.get(value);
    return match ? localizedCatalogName(match, locale) : value;
  };
}

/** "中文\nTiếng Việt" for documents that always print both languages (the hazard report). */
export function makeBilingualResolver(items: { nameVi: string; nameZh: string | null }[]) {
  const byName = new Map<string, { nameVi: string; nameZh: string | null }>();
  for (const item of items) {
    byName.set(item.nameVi, item);
    if (item.nameZh) byName.set(item.nameZh, item);
  }
  return (value: string | null): string | null => {
    if (!value) return value;
    const match = byName.get(value);
    if (!match || !match.nameZh || match.nameZh === match.nameVi) return match?.nameVi ?? value;
    return `${match.nameZh}\n${match.nameVi}`;
  };
}
