import { ShoppingCart } from "lucide-react";
import { tryApiAccess } from "@/server/api-guard";
import { NoPermissionState } from "@/components/no-permission-state";
import { PERMISSIONS } from "@/server/permissions";
import { ModuleEmptyState } from "@/components/module-empty-state";

export default async function ProcurementPage() {
  const access = await tryApiAccess(PERMISSIONS.PROCUREMENT_VIEW);
  if ("denied" in access) return <NoPermissionState />;
  return (
    <ModuleEmptyState
      icon={ShoppingCart}
      titleKey="nav.procurement"
      messageKey="modules.procurement.empty"
      illustrationSrc="/illustrations/procurement.webp"
    />
  );
}
