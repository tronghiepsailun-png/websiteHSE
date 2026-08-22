"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, ShieldAlert, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { OrgSwitcher } from "@/components/layout/org-switcher";
import { UserMenu } from "@/components/layout/user-menu";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { HeaderSlotProvider, HeaderSlotOutlet } from "@/components/layout/header-slot";
import { T } from "@/components/i18n/t";
import { useT } from "@/lib/i18n/locale-context";

type OrgSummary = { id: string; name: string; code: string };

export function AppShell({
  children,
  user,
  activeOrg,
  organizations,
  permissionKeys,
  showSettings,
}: {
  children: React.ReactNode;
  user: { name: string; email: string; isPlatformAdmin: boolean };
  activeOrg: OrgSummary | null;
  organizations: OrgSummary[];
  permissionKeys: string[] | null;
  showSettings: boolean;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const t = useT();

  return (
    <HeaderSlotProvider>
    <div className="flex min-h-screen flex-1">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 border-r bg-background md:flex md:flex-col">
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <ShieldAlert className="size-5 text-primary" />
          <span className="font-semibold">
            <T k="common.appName" />
          </span>
        </div>
        <div className="flex-1 overflow-y-auto">
          <SidebarNav permissionKeys={permissionKeys} />
        </div>
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-60 p-0">
          <SheetTitle className="flex h-14 items-center gap-2 border-b px-4 text-left text-base">
            <ShieldAlert className="size-5 text-primary" />
            <T k="common.appName" />
          </SheetTitle>
          <SidebarNav permissionKeys={permissionKeys} onNavigate={() => setMobileNavOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b bg-background px-4">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileNavOpen(true)}>
            <Menu className="size-5" />
          </Button>

          <Link href="/" className="font-semibold md:hidden">
            <T k="common.appName" />
          </Link>

          <div className="hidden md:block">
            <OrgSwitcher activeOrg={activeOrg} organizations={organizations} />
          </div>

          <HeaderSlotOutlet className="flex min-w-0 flex-1 items-center justify-center" />

          <div className="ml-auto flex items-center gap-1.5">
            <Button variant="ghost" size="icon" disabled title={t("common.notifications")}>
              <Bell className="size-4.5" />
            </Button>
            <LanguageSwitcher />
            <Separator orientation="vertical" className="mx-1 h-5" />
            <UserMenu name={user.name} email={user.email} isPlatformAdmin={user.isPlatformAdmin} showSettings={showSettings} />
          </div>
        </header>

        <div className="border-b bg-background px-4 py-2 md:hidden">
          <OrgSwitcher activeOrg={activeOrg} organizations={organizations} />
        </div>

        <main className="min-w-0 flex-1 overflow-x-hidden bg-muted/30 p-4 md:p-6">
          <div className="mx-auto w-full max-w-[1600px]">{children}</div>
        </main>
      </div>
    </div>
    </HeaderSlotProvider>
  );
}
