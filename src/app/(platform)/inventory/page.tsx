import { Warehouse } from "lucide-react";
import { requireApiAccess } from "@/server/api-guard";
import { ModuleEmptyState } from "@/components/module-empty-state";

export default async function InventoryPage() {
  await requireApiAccess(null);
  return <ModuleEmptyState icon={Warehouse} titleKey="nav.inventory" messageKey="modules.inventory.empty" />;
}
