import { AlertTriangle } from "lucide-react";
import { tryApiAccess } from "@/server/api-guard";
import { NoPermissionState } from "@/components/no-permission-state";
import { PERMISSIONS } from "@/server/permissions";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { T } from "@/components/i18n/t";

export default async function ViolationsExternalPage() {
  const access = await tryApiAccess(PERMISSIONS.VIOLATION_VIEW);
  if ("denied" in access) return <NoPermissionState />;

  return (
    <Card>
      <CardContent className="pt-6">
        <EmptyState icon={AlertTriangle} message={<T k="modules.violationsExternal.empty" />} className="py-16" />
      </CardContent>
    </Card>
  );
}
