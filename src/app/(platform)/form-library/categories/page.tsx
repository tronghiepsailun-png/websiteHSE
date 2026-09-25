import Link from "next/link";
import { tryApiAccess } from "@/server/api-guard";
import { NoPermissionState } from "@/components/no-permission-state";
import { PERMISSIONS } from "@/server/permissions";
import { listCatalogItems } from "@/server/catalog";
import { T } from "@/components/i18n/t";
import { CatalogEditor } from "@/components/catalog/catalog-editor";

export default async function FormLibraryCategoriesPage() {
  const access = await tryApiAccess(PERMISSIONS.FORMS_EDIT);
  if ("denied" in access) return <NoPermissionState />;

  const categories = await listCatalogItems(access.organizationId, "forms", "category");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/form-library" className="text-sm text-muted-foreground hover:underline">
          ← <T k="forms.back" />
        </Link>
        <h1 className="text-xl font-semibold">
          <T k="forms.catalog.title" />
        </h1>
        <p className="text-sm text-muted-foreground">
          <T k="forms.catalog.subtitle" />
        </p>
      </div>

      <CatalogEditor module="forms" kind="category" titleKey="forms.catalog.category" items={categories} deleteConfirmKey="forms.catalog.deleteConfirm" />
    </div>
  );
}
