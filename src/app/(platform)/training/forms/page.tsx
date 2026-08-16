import { FileSpreadsheet } from "lucide-react";
import { requireApiAccess } from "@/server/api-guard";
import { ModuleEmptyState } from "@/components/module-empty-state";

export default async function TrainingFormsPage() {
  await requireApiAccess(null);
  return <ModuleEmptyState icon={FileSpreadsheet} titleKey="nav.trainingForms" messageKey="modules.trainingForms.empty" />;
}
