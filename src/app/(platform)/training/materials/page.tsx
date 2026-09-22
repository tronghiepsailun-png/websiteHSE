import { Library } from "lucide-react";
import { tryApiAccess } from "@/server/api-guard";
import { NoPermissionState } from "@/components/no-permission-state";
import { PERMISSIONS } from "@/server/permissions";
import { ModuleEmptyState } from "@/components/module-empty-state";

export default async function TrainingMaterialsPage() {
  const access = await tryApiAccess(PERMISSIONS.TRAINING_MATERIALS_VIEW);
  if ("denied" in access) return <NoPermissionState />;
  return (
    <ModuleEmptyState
      icon={Library}
      titleKey="nav.trainingMaterials"
      messageKey="modules.trainingMaterials.empty"
      illustrationSrc="/illustrations/training-materials.webp"
    />
  );
}
