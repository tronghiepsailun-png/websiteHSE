import Link from "next/link";
import { tryApiAccess } from "@/server/api-guard";
import { NoPermissionState } from "@/components/no-permission-state";
import { PERMISSIONS } from "@/server/permissions";
import { listCatalogItems } from "@/server/catalog";
import { T } from "@/components/i18n/t";
import { CatalogEditor } from "@/components/catalog/catalog-editor";

export default async function CapaCatalogPage() {
  const access = await tryApiAccess(PERMISSIONS.CAPA_EDIT);
  if ("denied" in access) return <NoPermissionState />;

  const [areas, depts] = await Promise.all([
    listCatalogItems(access.organizationId, "capa", "area"),
    listCatalogItems(access.organizationId, "capa", "dept"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/capa" className="text-sm text-muted-foreground hover:underline">
          ← <T k="nav.capa" />
        </Link>
        <h1 className="text-xl font-semibold">
          <T k="capa.catalog.title" />
        </h1>
        <p className="text-sm text-muted-foreground">
          <T k="capa.catalog.subtitle" />
        </p>
      </div>

      <CatalogEditor module="capa" kind="area" titleKey="capa.catalog.area" items={areas} />
      <CatalogEditor module="capa" kind="dept" titleKey="capa.catalog.dept" items={depts} />
    </div>
  );
}
