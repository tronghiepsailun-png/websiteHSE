"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, Leaf, Bell, PanelLeft, PanelLeftClose } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { CommandPalette } from "@/components/layout/command-palette";
import { OrgSwitcher } from "@/components/layout/org-switcher";
import { UserMenu } from "@/components/layout/user-menu";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { KeyboardShortcuts } from "@/components/layout/keyboard-shortcuts";
import { T } from "@/components/i18n/t";
import { useT } from "@/lib/i18n/locale-context";

type OrgSummary = { id: string; name: string; code: string };
type OverdueCapaItem = { id: string; action: string; dueDate: Date | null };

function fmtDate(d: Date | null) {
  if (!d) return "";
  return new Date(d).toLocaleDateString();
}

export function AppShell({
  children,
  user,
  activeOrg,
  organizations,
  permissionKeys,
  showSettings,
  overdueCapaItems,
}: {
  children: React.ReactNode;
  user: { name: string; email: string; isPlatformAdmin: boolean };
  activeOrg: OrgSummary | null;
  organizations: OrgSummary[];
  permissionKeys: string[] | null;
  showSettings: boolean;
  overdueCapaItems: OverdueCapaItem[];
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState(false);
  const t = useT();

  // Persisted independently of theme/locale — purely a layout preference, per browser.
  useEffect(() => {
    try {
      if (localStorage.getItem("hse_sidebar_collapsed") === "1") setRailCollapsed(true);
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("hse_sidebar_collapsed", railCollapsed ? "1" : "0");
    } catch {}
  }, [railCollapsed]);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar — the shell is viewport-height with overflow hidden, and only
          <main> below scrolls internally, so the sidebar (and header) stay in view no
          matter how long a page's content gets, instead of scrolling away with it. */}
      <aside
        className={cn(
          "hidden shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-200 md:flex",
          railCollapsed ? "w-16" : "w-60"
        )}
      >
        <div className={cn("flex h-14 items-center gap-2 border-b border-sidebar-border", railCollapsed ? "justify-center px-2" : "px-4")}>
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sidebar-primary/20">
            <Leaf className="size-4.5 text-sidebar-primary" />
          </span>
          {!railCollapsed && (
            <p className="min-w-0 truncate text-sm font-semibold text-sidebar-foreground">
              <T k="common.appName" />
            </p>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          <SidebarNav collapsed={railCollapsed} />
        </div>
        <button
          type="button"
          onClick={() => setRailCollapsed((v) => !v)}
          title={t(railCollapsed ? "layout.sidebar.expand" : "layout.sidebar.collapse")}
          className="flex h-10 shrink-0 items-center justify-center gap-2 border-t border-sidebar-border text-sidebar-foreground/70 transition-colors hover:bg-white/10 hover:text-sidebar-foreground"
        >
          {railCollapsed ? (
            <PanelLeft className="size-4" />
          ) : (
            <>
              <PanelLeftClose className="size-4" />
              <span className="text-xs">{t("layout.sidebar.collapse")}</span>
            </>
          )}
        </button>
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-60 bg-sidebar p-0 text-sidebar-foreground">
          <SheetTitle className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4 text-left text-base text-sidebar-foreground">
            <Leaf className="size-5 text-sidebar-primary" />
            <T k="common.appName" />
          </SheetTitle>
          <SidebarNav onNavigate={() => setMobileNavOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-background px-4">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileNavOpen(true)}>
            <Menu className="size-5" />
          </Button>

          <Link href="/" className="font-semibold md:hidden">
            <T k="common.appName" />
          </Link>

          <div className="hidden md:block">
            <OrgSwitcher activeOrg={activeOrg} organizations={organizations} />
          </div>

          <CommandPalette permissionKeys={permissionKeys} />
          <KeyboardShortcuts />

          <div className="hidden lg:block">
            <Breadcrumb />
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" size="icon" className="relative" title={t("common.notifications")} />
                }
              >
                <Bell className="size-4.5" />
                {overdueCapaItems.length > 0 && (
                  <span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold text-white">
                    {overdueCapaItems.length}
                  </span>
                )}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>{t("common.notifications")}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {overdueCapaItems.length === 0 ? (
                    <p className="px-1.5 py-2 text-sm text-muted-foreground">{t("common.notificationsEmpty")}</p>
                  ) : (
                    overdueCapaItems.map((item) => (
                      <DropdownMenuItem key={item.id} render={<Link href="/capa" />} className="flex-col items-start gap-0.5">
                        <span className="line-clamp-2 text-sm">{item.action}</span>
                        <span className="text-xs text-destructive">
                          {t("common.notificationOverdueSince", { date: fmtDate(item.dueDate) })}
                        </span>
                      </DropdownMenuItem>
                    ))
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem render={<Link href="/capa" />} className="justify-center text-sm text-primary">
                    {t("common.viewAll")}
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <ThemeToggle />
            <LanguageSwitcher />
            <Separator orientation="vertical" className="mx-1 h-5" />
            <UserMenu name={user.name} email={user.email} isPlatformAdmin={user.isPlatformAdmin} showSettings={showSettings} />
          </div>
        </header>

        <div className="shrink-0 border-b bg-background px-4 py-2 md:hidden">
          <OrgSwitcher activeOrg={activeOrg} organizations={organizations} />
        </div>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden bg-muted">
          <div className="mx-auto w-full max-w-[1600px] flex-1 p-4 md:p-6">{children}</div>
          <footer className="shrink-0 border-t bg-background px-4 py-3 text-center text-xs text-muted-foreground">
            {activeOrg?.name ?? t("common.appName")} · <T k="common.appName" /> · © {new Date().getFullYear()}
          </footer>
        </main>
      </div>
    </div>
  );
}
