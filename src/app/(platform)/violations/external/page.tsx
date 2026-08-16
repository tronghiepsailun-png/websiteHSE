import { AlertTriangle } from "lucide-react";
import { requireApiAccess } from "@/server/api-guard";
import { ModuleEmptyState } from "@/components/module-empty-state";

export default async function ViolationsExternalPage() {
  await requireApiAccess(null);
  return <ModuleEmptyState icon={AlertTriangle} titleKey="nav.violationsExternal" messageKey="modules.violationsExternal.empty" />;
}
