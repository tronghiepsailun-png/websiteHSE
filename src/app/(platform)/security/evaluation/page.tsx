import { Star } from "lucide-react";
import { tryApiAccess } from "@/server/api-guard";
import { NoPermissionState } from "@/components/no-permission-state";
import { PERMISSIONS } from "@/server/permissions";
import { ModuleEmptyState } from "@/components/module-empty-state";

export default async function EmployeeEvaluationPage() {
  const access = await tryApiAccess(PERMISSIONS.SECURITY_VIEW);
  if ("denied" in access) return <NoPermissionState />;
  return (
    <ModuleEmptyState
      icon={Star}
      titleKey="nav.employeeEvaluation"
      messageKey="modules.evaluation.empty"
      illustrationSrc="/illustrations/security-evaluation.webp"
    />
  );
}
