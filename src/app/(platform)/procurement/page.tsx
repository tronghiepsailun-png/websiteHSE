import { ShoppingCart } from "lucide-react";
import { requireApiAccess } from "@/server/api-guard";
import { ModuleEmptyState } from "@/components/module-empty-state";

export default async function ProcurementPage() {
  await requireApiAccess(null);
  return (
    <ModuleEmptyState
      icon={ShoppingCart}
      titleKey="nav.procurement"
      messageKey="modules.procurement.empty"
      illustrationSrc="/illustrations/procurement.webp"
    />
  );
}
