import { FileText } from "lucide-react";
import { requireApiAccess } from "@/server/api-guard";
import { ModuleEmptyState } from "@/components/module-empty-state";

export default async function DocumentsHsePage() {
  await requireApiAccess(null);
  return (
    <ModuleEmptyState
      icon={FileText}
      titleKey="nav.documentsHse"
      messageKey="modules.documentsHse.empty"
      illustrationSrc="/illustrations/documents-hse.webp"
    />
  );
}
