import { FileSpreadsheet } from "lucide-react";
import { tryApiAccess } from "@/server/api-guard";
import { NoPermissionState } from "@/components/no-permission-state";
import { PERMISSIONS } from "@/server/permissions";
import { ModuleEmptyState } from "@/components/module-empty-state";

export default async function FormsPage() {
  const access = await tryApiAccess(PERMISSIONS.FORMS_VIEW);
  if ("denied" in access) return <NoPermissionState />;
  return (
    <ModuleEmptyState
      icon={FileSpreadsheet}
      titleKey="nav.forms"
      messageKey="modules.forms.empty"
      illustrationSrc="/illustrations/forms.webp"
    />
  );
}
