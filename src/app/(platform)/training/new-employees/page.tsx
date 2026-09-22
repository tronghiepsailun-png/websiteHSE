import { GraduationCap } from "lucide-react";
import { requireApiAccess } from "@/server/api-guard";
import { ModuleEmptyState } from "@/components/module-empty-state";

export default async function TrainingNewEmployeesPage() {
  await requireApiAccess(null);
  return (
    <ModuleEmptyState
      icon={GraduationCap}
      titleKey="nav.trainingNewEmployees"
      messageKey="modules.trainingNewEmployees.empty"
      illustrationSrc="/illustrations/training-new-employees.webp"
    />
  );
}
