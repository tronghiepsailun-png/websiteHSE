import Link from "next/link";
import { requireApiAccess } from "@/server/api-guard";
import { PERMISSIONS } from "@/server/permissions";
import { getPermissionKeysForUserInOrg } from "@/server/rbac";
import { ADMIN_NAV_ITEMS, canSee } from "@/lib/nav";
import { Card, CardContent } from "@/components/ui/card";
import { T } from "@/components/i18n/t";

export default async function SettingsPage() {
  const ctx = await requireApiAccess(PERMISSIONS.CONFIG_MANAGE);

  const permissionKeys = ctx.isPlatformAdmin ? null : Array.from(await getPermissionKeysForUserInOrg(ctx.userId, ctx.organizationId));

  const tiles = ADMIN_NAV_ITEMS.filter((item) => canSee(item, permissionKeys));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">
          <T k="settings.title" />
        </h1>
        <p className="text-sm text-muted-foreground">
          <T k="settings.subtitle" />
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <Link key={tile.href} href={tile.href}>
              <Card className="h-full transition-colors hover:border-primary/50 hover:bg-muted/40">
                <CardContent className="flex items-center gap-3 pt-6">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Icon className="size-5" />
                  </div>
                  <span className="font-medium">
                    <T k={tile.labelKey} />
                  </span>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
