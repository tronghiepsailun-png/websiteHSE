import { BookOpen } from "lucide-react";
import { tryApiAccess } from "@/server/api-guard";
import { NoPermissionState } from "@/components/no-permission-state";
import { PERMISSIONS } from "@/server/permissions";
import { ModuleEmptyState } from "@/components/module-empty-state";

export default async function TrainingIncidentsPage() {
  const access = await tryApiAccess(PERMISSIONS.TRAINING_INCIDENTS_VIEW);
  if ("denied" in access) return <NoPermissionState />;
  return (
    <ModuleEmptyState
      icon={BookOpen}
      titleKey="nav.trainingIncidents"
      messageKey="modules.trainingIncidents.empty"
      illustrationSrc="/illustrations/training-incidents.webp"
    />
  );
}
