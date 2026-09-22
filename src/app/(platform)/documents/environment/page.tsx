import { Leaf } from "lucide-react";
import { requireApiAccess } from "@/server/api-guard";
import { ModuleEmptyState } from "@/components/module-empty-state";

export default async function DocumentsEnvironmentPage() {
  await requireApiAccess(null);
  return (
    <ModuleEmptyState
      icon={Leaf}
      titleKey="nav.documentsEnvironment"
      messageKey="modules.documentsEnvironment.empty"
      illustrationSrc="/illustrations/documents-environment.webp"
    />
  );
}
