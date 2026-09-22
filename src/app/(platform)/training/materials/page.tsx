import { Library } from "lucide-react";
import { requireApiAccess } from "@/server/api-guard";
import { ModuleEmptyState } from "@/components/module-empty-state";

export default async function TrainingMaterialsPage() {
  await requireApiAccess(null);
  return (
    <ModuleEmptyState
      icon={Library}
      titleKey="nav.trainingMaterials"
      messageKey="modules.trainingMaterials.empty"
      illustrationSrc="/illustrations/training-materials.webp"
    />
  );
}
