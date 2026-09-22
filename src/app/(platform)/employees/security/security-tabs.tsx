"use client";

import { usePathname } from "next/navigation";
import { Clock, Star } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { T } from "@/components/i18n/t";
import type { DictionaryKey } from "@/lib/i18n/translate";
import { HorizontalScroll } from "@/components/ui/horizontal-scroll";

const TABS: { href: string; labelKey: DictionaryKey; icon: LucideIcon; fg: string; bg: string }[] = [
  { href: "/employees/security/attendance", labelKey: "employees.security.tabAttendance", icon: Clock, fg: "#2563eb", bg: "#dbeafe" },
  { href: "/employees/security/evaluation", labelKey: "employees.security.tabEvaluation", icon: Star, fg: "#d97706", bg: "#fef3c7" },
];

// Same plain-<a> pattern as violations/violations-tabs.tsx — a real full page load on every
// tab switch, so each tab's own data is always fresh instead of risking a stale Router Cache hit.
export function SecurityTabs() {
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
            style={active ? { backgroundColor: tab.bg, borderColor: tab.fg, color: tab.fg } : undefined}
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
