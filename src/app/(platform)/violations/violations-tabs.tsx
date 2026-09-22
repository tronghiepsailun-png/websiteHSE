"use client";

import { usePathname } from "next/navigation";
import { LayoutGrid, AlertOctagon, ShieldX, AlertTriangle, Link2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { T } from "@/components/i18n/t";
import type { DictionaryKey } from "@/lib/i18n/translate";
import { HorizontalScroll } from "@/components/ui/horizontal-scroll";

const TABS: { href: string; labelKey: DictionaryKey; icon: LucideIcon; fg: string; bg: string }[] = [
  { href: "/violations", labelKey: "violations.tabs.overview", icon: LayoutGrid, fg: "#16a34a", bg: "#dcfce7" },
  { href: "/violations/5s", labelKey: "nav.violations5s", icon: AlertOctagon, fg: "#ea580c", bg: "#ffedd5" },
  { href: "/violations/internal", labelKey: "nav.violationsInternal", icon: ShieldX, fg: "#dc2626", bg: "#fee2e2" },
  { href: "/violations/external", labelKey: "nav.violationsExternal", icon: AlertTriangle, fg: "#d97706", bg: "#fef3c7" },
  { href: "/violations/lien-de", labelKey: "nav.violationsLienDe", icon: Link2, fg: "#2563eb", bg: "#dbeafe" },
];

/** Deliberately a plain <a>, not next/link — same reasoning as the incidents ReportTabs:
 *  Next's client Router Cache could otherwise keep serving a stale view of one tab's
 *  aggregates after data changes on another, since these are real separate routes. A plain
 *  anchor forces a full page load every time, guaranteeing fresh data on every tab switch. */
export function ViolationsTabs() {
  const pathname = usePathname();
  return (
    <HorizontalScroll className="flex max-w-full flex-nowrap items-stretch gap-2">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        const Icon = tab.icon;
        return (
          <a
            key={tab.href}
            href={tab.href}
            style={
              active
                ? { backgroundColor: tab.bg, borderColor: tab.fg, color: tab.fg }
                : undefined
            }
            className={cn(
              "flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold whitespace-nowrap transition-all duration-150",
              active
                ? "shadow-sm"
                : "border-transparent bg-muted/60 text-muted-foreground hover:-translate-y-0.5 hover:bg-muted hover:text-foreground hover:shadow-sm"
            )}
          >
            <span
              className="flex size-6 shrink-0 items-center justify-center rounded-md"
              style={active ? { backgroundColor: tab.fg, color: "#fff" } : { backgroundColor: tab.bg, color: tab.fg }}
            >
              <Icon className="size-3.5" />
            </span>
            <T k={tab.labelKey} />
          </a>
        );
      })}
    </HorizontalScroll>
  );
}
