import { FileSpreadsheet } from "lucide-react";
import { tryApiAccess } from "@/server/api-guard";
import { NoPermissionState } from "@/components/no-permission-state";
import { PERMISSIONS } from "@/server/permissions";
import { ModuleEmptyState } from "@/components/module-empty-state";

export default async function TrainingFormsPage() {
  const access = await tryApiAccess(PERMISSIONS.TRAINING_FORMS_VIEW);
  if ("denied" in access) return <NoPermissionState />;
  return (
    <ModuleEmptyState
      icon={FileSpreadsheet}
      titleKey="nav.trainingForms"
      messageKey="modules.trainingForms.empty"
      illustrationSrc="/illustrations/training-forms.webp"
    />
  );
}
