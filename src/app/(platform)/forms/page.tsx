import { FileSpreadsheet } from "lucide-react";
import { requireApiAccess } from "@/server/api-guard";
import { ModuleEmptyState } from "@/components/module-empty-state";

export default async function FormsPage() {
  await requireApiAccess(null);
  return (
    <ModuleEmptyState
      icon={FileSpreadsheet}
      titleKey="nav.forms"
      messageKey="modules.forms.empty"
      illustrationSrc="/illustrations/forms.webp"
    />
  );
}
