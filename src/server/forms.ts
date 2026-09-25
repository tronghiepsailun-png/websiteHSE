import { prisma } from "@/lib/prisma";
import { listCatalogItems, type CatalogItemRow } from "@/server/catalog";
import type { FormDto, FormFileDto } from "@/lib/form-files";

export const FORMS_MODULE = "forms";
/** A file that was replaced by a newer one — kept in storage and in the Document table, just no longer listed. */
export const ARCHIVED_TAG = "archived";

export { extensionOf, formFileMime, type FormDto, type FormFileDto } from "@/lib/form-files";

/** Everything the library page shows: the categories and every form with its live (non-archived)
 *  files. Hidden forms/categories are only included for people who manage the library. */
export async function loadFormLibrary(organizationId: string, includeHidden: boolean): Promise<{ categories: CatalogItemRow[]; forms: FormDto[] }> {
  const [allCategories, rows] = await Promise.all([
    listCatalogItems(organizationId, FORMS_MODULE, "category"),
    prisma.formTemplate.findMany({
      where: { organizationId, ...(includeHidden ? {} : { isActive: true }) },
      orderBy: [{ sortOrder: "asc" }, { nameVi: "asc" }],
    }),
  ]);
  const categories = includeHidden ? allCategories : allCategories.filter((c) => c.isActive);

  const docs = rows.length
    ? await prisma.document.findMany({
        where: { organizationId, module: FORMS_MODULE, recordId: { in: rows.map((r) => r.id) }, OR: [{ tag: null }, { tag: { not: ARCHIVED_TAG } }] },
        orderBy: { uploadedAt: "asc" },
        select: { id: true, recordId: true, fileName: true, fileType: true, sizeBytes: true, uploadedAt: true },
      })
    : [];
  const filesByForm = new Map<string, FormFileDto[]>();
  for (const d of docs) {
    const list = filesByForm.get(d.recordId) ?? [];
    list.push({ id: d.id, fileName: d.fileName, fileType: d.fileType, sizeBytes: d.sizeBytes, uploadedAt: d.uploadedAt });
    filesByForm.set(d.recordId, list);
  }

  const visibleCategoryIds = new Set(categories.map((c) => c.id));
  const forms: FormDto[] = rows
    .filter((r) => visibleCategoryIds.has(r.categoryId))
    .map((r) => {
      const files = filesByForm.get(r.id) ?? [];
      // "Updated" is when its newest file arrived; a form with no file yet falls back to its own last edit.
      const updatedAt = files.reduce<Date>((latest, f) => (f.uploadedAt > latest ? f.uploadedAt : latest), files.length ? files[0].uploadedAt : r.updatedAt);
      return {
        id: r.id,
        categoryId: r.categoryId,
        code: r.code,
        nameVi: r.nameVi,
        nameZh: r.nameZh,
        descriptionVi: r.descriptionVi,
        descriptionZh: r.descriptionZh,
        isActive: r.isActive,
        updatedAt,
        files,
      };
    });

  return { categories, forms };
}
