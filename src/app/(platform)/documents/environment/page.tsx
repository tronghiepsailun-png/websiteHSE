import { Leaf } from "lucide-react";
import { tryApiAccess } from "@/server/api-guard";
import { NoPermissionState } from "@/components/no-permission-state";
import { PERMISSIONS } from "@/server/permissions";
import { ModuleEmptyState } from "@/components/module-empty-state";

export default async function DocumentsEnvironmentPage() {
  const access = await tryApiAccess(PERMISSIONS.DOCS_ENVIRONMENT_VIEW);
  if ("denied" in access) return <NoPermissionState />;
  return (
    <ModuleEmptyState
      icon={Leaf}
      titleKey="nav.documentsEnvironment"
      messageKey="modules.documentsEnvironment.empty"
      illustrationSrc="/illustrations/documents-environment.webp"
    />
  );
}
