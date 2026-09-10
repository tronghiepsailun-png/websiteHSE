import { Star } from "lucide-react";
import { requireApiAccess } from "@/server/api-guard";
import { ModuleEmptyState } from "@/components/module-empty-state";

export default async function EmployeeEvaluationPage() {
  await requireApiAccess(null);
  return <ModuleEmptyState icon={Star} titleKey="nav.employeeEvaluation" messageKey="modules.evaluation.empty" />;
}
