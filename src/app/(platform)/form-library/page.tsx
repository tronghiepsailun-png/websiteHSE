import { tryApiAccess } from "@/server/api-guard";
import { NoPermissionState } from "@/components/no-permission-state";
import { PERMISSIONS } from "@/server/permissions";
import { getPermissionKeysForUserInOrg } from "@/server/rbac";
import { loadFormLibrary } from "@/server/forms";
import { FormLibraryView } from "./form-library-view";

export default async function FormLibraryPage() {
  const access = await tryApiAccess(PERMISSIONS.FORMS_VIEW);
  if ("denied" in access) return <NoPermissionState />;

  const canEdit = access.isPlatformAdmin || (await getPermissionKeysForUserInOrg(access.userId, access.organizationId)).has(PERMISSIONS.FORMS_EDIT);
  const { categories, forms } = await loadFormLibrary(access.organizationId, canEdit);

  return <FormLibraryView categories={categories} forms={forms} canEdit={canEdit} />;
}
