"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Leaf, Bell, LayoutDashboard, AlertTriangle, ClipboardCheck, ListTodo } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
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
import { OrgSwitcher } from "@/components/layout/org-switcher";
import { UserMenu } from "@/components/layout/user-menu";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { DocumentTitle } from "@/components/layout/breadcrumb";
import { T } from "@/components/i18n/t";
import { useT } from "@/lib/i18n/locale-context";
import type { DictionaryKey } from "@/lib/i18n/translate";

type OrgSummary = { id: string; name: string; code: string };
type OverdueCapaItem = { id: string; action: string; dueDate: Date | null };

function fmtDate(d: Date | null) {
  if (!d) return "";
  return new Date(d).toLocaleDateString();
}

// Bottom-nav usability research caps this around 5 destinations before mis-taps climb — the
// rest of the app's modules stay one tap away behind "Thêm" (which opens the very same
// SidebarNav the desktop drawer uses), rather than crowding a 6th/7th icon in here.
const TAB_ITEMS: { href: string; labelKey: DictionaryKey; icon: typeof LayoutDashboard }[] = [
  { href: "/", labelKey: "nav.dashboard", icon: LayoutDashboard },
  { href: "/incidents", labelKey: "nav.incidents", icon: AlertTriangle },
  { href: "/capa", labelKey: "nav.capa", icon: ClipboardCheck },
  { href: "/planning", labelKey: "nav.workPlan", icon: ListTodo },
];

function useActiveTab() {
  const pathname = usePathname();
  return useMemo(() => {
    let best: string | null = null;
    for (const item of TAB_ITEMS) {
      const matches = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
      if (matches && (best === null || item.href.length > best.length)) best = item.href;
    }
    return best;
  }, [pathname]);
}

/** Phone-optimized shell — a genuinely different layout from AppShell (bottom tab bar instead
 *  of a sidebar, no Command Palette/Breadcrumb/keyboard shortcuts, larger touch targets via the
 *  `.mobile-shell` CSS scope in globals.css), not just AppShell squeezed by a breakpoint.
 *  Rendered instead of AppShell by (platform)/layout.tsx based on isMobileDevice(). */
export function MobileShell({
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
  const [moreOpen, setMoreOpen] = useState(false);
  const activeTab = useActiveTab();
  const t = useT();

  return (
    <div className="mobile-shell flex h-screen flex-col overflow-hidden">
      <DocumentTitle />
      <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Leaf className="size-4.5 text-primary" />
        </span>
        <p className="min-w-0 flex-1 truncate text-sm font-semibold">
          <T k="common.appName" />
        </p>

        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="relative" title={t("common.notifications")} aria-label={t("common.notifications")} />}>
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
                    <span className="text-xs text-destructive">{t("common.notificationOverdueSince", { date: fmtDate(item.dueDate) })}</span>
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
        <UserMenu name={user.name} email={user.email} isPlatformAdmin={user.isPlatformAdmin} showSettings={showSettings} />
      </header>

      {organizations.length > 1 && (
        <div className="shrink-0 border-b bg-background px-3 py-2">
          <OrgSwitcher activeOrg={activeOrg} organizations={organizations} />
        </div>
      )}

      <main id="main-content" className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-muted pb-4">
        <div className="w-full p-3">{children}</div>
      </main>

      {/* Bottom tab bar — fixed, safe-area-aware, ≥48px touch targets per row (see
          globals.css .mobile-shell block for the app-wide control-size bump). */}
      <nav className="flex shrink-0 border-t bg-background pb-[env(safe-area-inset-bottom)]">
        {TAB_ITEMS.map(({ href, labelKey, icon: Icon }) => {
          const active = href === activeTab;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className="size-5" />
              <T k={labelKey} />
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className="flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted-foreground"
        >
          <Menu className="size-5" />
          <T k="common.more" />
        </button>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="left" className="w-[82%] bg-sidebar p-0 text-sidebar-foreground">
          <SheetTitle className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4 text-left text-base text-sidebar-foreground">
            <Leaf className="size-5 text-sidebar-primary" />
            <T k="common.appName" />
          </SheetTitle>
          <div className="flex items-center gap-2 border-b border-sidebar-border px-4 py-3">
            <LanguageSwitcher />
          </div>
          <div className="flex-1 overflow-y-auto">
            <SidebarNav onNavigate={() => setMoreOpen(false)} compact permissionKeys={permissionKeys} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
