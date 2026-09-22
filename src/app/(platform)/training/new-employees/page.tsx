import { GraduationCap } from "lucide-react";
import { tryApiAccess } from "@/server/api-guard";
import { NoPermissionState } from "@/components/no-permission-state";
import { PERMISSIONS } from "@/server/permissions";
import { ModuleEmptyState } from "@/components/module-empty-state";

export default async function TrainingNewEmployeesPage() {
  const access = await tryApiAccess(PERMISSIONS.TRAINING_NEW_EMPLOYEES_VIEW);
  if ("denied" in access) return <NoPermissionState />;
  return (
    <ModuleEmptyState
      icon={GraduationCap}
      titleKey="nav.trainingNewEmployees"
      messageKey="modules.trainingNewEmployees.empty"
      illustrationSrc="/illustrations/training-new-employees.webp"
    />
  );
}
