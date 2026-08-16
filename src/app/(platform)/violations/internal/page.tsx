import { ShieldX } from "lucide-react";
import { requireApiAccess } from "@/server/api-guard";
import { ModuleEmptyState } from "@/components/module-empty-state";

export default async function ViolationsInternalPage() {
  await requireApiAccess(null);
  return <ModuleEmptyState icon={ShieldX} titleKey="nav.violationsInternal" messageKey="modules.violationsInternal.empty" />;
}
