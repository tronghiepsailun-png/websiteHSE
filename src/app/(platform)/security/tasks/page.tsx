import { ClipboardList } from "lucide-react";
import { tryApiAccess } from "@/server/api-guard";
import { NoPermissionState } from "@/components/no-permission-state";
import { PERMISSIONS } from "@/server/permissions";
import { ModuleEmptyState } from "@/components/module-empty-state";

export default async function SecurityTasksPage() {
  const access = await tryApiAccess(PERMISSIONS.SECURITY_VIEW);
  if ("denied" in access) return <NoPermissionState />;
  return <ModuleEmptyState icon={ClipboardList} titleKey="nav.securityTasks" messageKey="modules.securityTasks.empty" />;
}
