import { FileText } from "lucide-react";
import { tryApiAccess } from "@/server/api-guard";
import { NoPermissionState } from "@/components/no-permission-state";
import { PERMISSIONS } from "@/server/permissions";
import { ModuleEmptyState } from "@/components/module-empty-state";

export default async function DocumentsHsePage() {
  const access = await tryApiAccess(PERMISSIONS.DOCS_HSE_VIEW);
  if ("denied" in access) return <NoPermissionState />;
  return (
    <ModuleEmptyState
      icon={FileText}
      titleKey="nav.documentsHse"
      messageKey="modules.documentsHse.empty"
      illustrationSrc="/illustrations/documents-hse.webp"
    />
  );
}
