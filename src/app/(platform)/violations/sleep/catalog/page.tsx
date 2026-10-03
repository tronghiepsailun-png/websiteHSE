import Link from "next/link";
import { tryApiAccess } from "@/server/api-guard";
import { NoPermissionState } from "@/components/no-permission-state";
import { PERMISSIONS } from "@/server/permissions";
import { listCatalogItems } from "@/server/catalog";
import { ensureSleepCatalogSeeded, SLEEP_MODULE } from "@/server/sleep-violations";
import { T } from "@/components/i18n/t";
import { CatalogEditor } from "@/components/catalog/catalog-editor";

/** Every quick-pick list of the "Vi phạm (ngủ)" row, each freely editable: the checking guards
 *  (MSNV + report color), places, and penalty-note texts. Factory/department/position aren't
 *  lists — they're read from the picked employee's own record. */
export default async function SleepCatalogPage() {
  const access = await tryApiAccess(PERMISSIONS.VIOLATION_EDIT);
  if ("denied" in access) return <NoPermissionState />;
  const orgId = access.organizationId;

  await ensureSleepCatalogSeeded(orgId);
  const [guards, locations, notes] = await Promise.all(["guard", "location", "note"].map((kind) => listCatalogItems(orgId, SLEEP_MODULE, kind)));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/violations/sleep" className="text-sm text-muted-foreground hover:underline">
          ← <T k="nav.violationsSleep" />
        </Link>
        <h1 className="text-xl font-semibold">
          <T k="sleep.catalog.title" />
        </h1>
        <p className="text-sm text-muted-foreground">
          <T k="sleep.catalog.subtitle" />
        </p>
      </div>

      <CatalogEditor module={SLEEP_MODULE} kind="guard" titleKey="sleep.catalog.guard" items={guards} withCode withColor hintKey="sleep.catalog.guardHint" />
      <CatalogEditor module={SLEEP_MODULE} kind="location" titleKey="sleep.catalog.location" items={locations} />
      <CatalogEditor
        module={SLEEP_MODULE}
        kind="note"
        titleKey="sleep.catalog.note"
        items={notes}
        nameViKey="sleep.catalog.noteVi"
        nameZhKey="sleep.catalog.noteZh"
        hintKey="sleep.catalog.noteHint"
      />
    </div>
  );
}
