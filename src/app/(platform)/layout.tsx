import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionUser, listMembershipsForUser, ACTIVE_ORG_COOKIE } from "@/server/org-context";
import { getPermissionKeysForUserInOrg } from "@/server/rbac";
import { PERMISSIONS } from "@/server/permissions";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/app-shell";
import { OrganizationPicker } from "@/components/layout/organization-picker";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { T } from "@/components/i18n/t";
import { t } from "@/lib/i18n/translate";
import { getLocale } from "@/lib/i18n/get-locale.server";

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser().catch(() => null);
  if (!user) redirect("/login");

  // Platform Admins aren't necessarily a "member" of any organization (that's normal —
  // they operate across all of them), so their switcher lists every active tenant
  // instead of just their own UserOrganization rows.
  const availableOrgs = user.isPlatformAdmin
    ? await prisma.organization.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, code: true },
      })
    : (await listMembershipsForUser(user.id)).map((m) => ({
        id: m.organization.id,
        name: m.organization.name,
        code: m.organization.code,
      }));

  const store = await cookies();
  const cookieOrgId = store.get(ACTIVE_ORG_COOKIE)?.value ?? null;
  const activeOrg = cookieOrgId ? (availableOrgs.find((o) => o.id === cookieOrgId) ?? null) : null;

  if (!activeOrg && availableOrgs.length > 0) {
    // No valid selection yet — ask the user to pick one instead of silently guessing
    // (silently defaulting to "the first org" would be an easy way to leak the wrong
    // tenant's data onto the screen if the cookie check above is ever wrong).
    return <OrganizationPicker memberships={availableOrgs} />;
  }

  if (!activeOrg && !user.isPlatformAdmin) {
    return (
      <div className="relative flex flex-1 items-center justify-center p-8 text-center">
        <div className="absolute right-4 top-4">
          <LanguageSwitcher />
        </div>
        <div className="max-w-sm space-y-2">
          <h1 className="text-lg font-semibold">
            <T k="org.noAccessTitle" />
          </h1>
          <p className="text-sm text-muted-foreground">
            <T k="org.noAccessDescription" />
          </p>
        </div>
      </div>
    );
  }

  const permissionKeys = activeOrg
    ? user.isPlatformAdmin
      ? null // null = full access, checked in components as "isPlatformAdmin || permissions.has(x)"
      : await getPermissionKeysForUserInOrg(user.id, activeOrg.id)
    : new Set<string>();

  const locale = await getLocale();
  const permissionKeysArray = permissionKeys ? Array.from(permissionKeys) : null;
  const showSettings = permissionKeysArray === null || permissionKeysArray.includes(PERMISSIONS.CONFIG_MANAGE);

  return (
    <AppShell
      user={{
        name: user.name ?? user.email ?? t(locale, "common.userFallback"),
        email: user.email ?? "",
        isPlatformAdmin: user.isPlatformAdmin,
      }}
      activeOrg={activeOrg}
      organizations={availableOrgs}
      permissionKeys={permissionKeysArray}
      showSettings={showSettings}
    >
      {children}
    </AppShell>
  );
}
