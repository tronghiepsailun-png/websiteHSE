import { AlertOctagon } from "lucide-react";
import { requireApiAccess } from "@/server/api-guard";
import { ModuleEmptyState } from "@/components/module-empty-state";

export default async function Violations5sPage() {
  await requireApiAccess(null);
  return <ModuleEmptyState icon={AlertOctagon} titleKey="nav.violations5s" messageKey="modules.violations5s.empty" />;
}
