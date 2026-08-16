import { BookOpen } from "lucide-react";
import { requireApiAccess } from "@/server/api-guard";
import { ModuleEmptyState } from "@/components/module-empty-state";

export default async function TrainingIncidentsPage() {
  await requireApiAccess(null);
  return <ModuleEmptyState icon={BookOpen} titleKey="nav.trainingIncidents" messageKey="modules.trainingIncidents.empty" />;
}
