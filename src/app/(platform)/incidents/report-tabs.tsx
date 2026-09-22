"use client";

import { AlertTriangle, BarChart3, Star, TrendingDown, Target } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { T } from "@/components/i18n/t";
import type { DictionaryKey } from "@/lib/i18n/translate";
import { type ReportView } from "./report-view";
import { HorizontalScroll } from "@/components/ui/horizontal-scroll";

// Same accent colors as this page's own KPI cards (green/blue/amber/purple), plus one more
// (teal) for the 5th tab — keeps the tab bar visually tied to the dashboard it switches between.
const TABS: { value: ReportView; labelKey: DictionaryKey; icon: LucideIcon; fg: string; bg: string }[] = [
  { value: "detail", labelKey: "incidents.tabs.detail", icon: AlertTriangle, fg: "#16a34a", bg: "#dcfce7" },
  { value: "stats", labelKey: "incidents.tabs.stats", icon: BarChart3, fg: "#2563eb", bg: "#dbeafe" },
  { value: "score", labelKey: "incidents.tabs.score", icon: Star, fg: "#d97706", bg: "#fef3c7" },
  { value: "deduction", labelKey: "incidents.tabs.deduction", icon: TrendingDown, fg: "#9333ea", bg: "#f3e8ff" },
  { value: "kpi", labelKey: "incidents.tabs.kpi", icon: Target, fg: "#0d9488", bg: "#ccfbf1" },
];

/** Deliberately a plain <a>, not next/link — Next's client Router Cache can keep serving
 *  whatever this exact URL rendered the last time it was visited in this tab (a documented
 *  "back/forward cache" behavior that isn't controlled by the staleTimes config), so switching
 *  tabs via client-side navigation could show stale aggregates after an incident is added/edited
 *  elsewhere, even though the server itself always has fresh data. A plain anchor forces a full
 *  page load every time, guaranteeing this report data is never stale. */
export function ReportTabs({ active }: { active: ReportView }) {
  return (
    <HorizontalScroll className="flex max-w-full flex-nowrap items-stretch gap-2">
      {TABS.map((tab) => {
        const href = tab.value === "detail" ? "/incidents" : `/incidents?view=${tab.value}`;
        const isActive = active === tab.value;
        const Icon = tab.icon;
        return (
          <a
            key={tab.value}
            href={href}
            style={isActive ? { backgroundColor: tab.bg, borderColor: tab.fg, color: tab.fg } : undefined}
            className={cn(
              "flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold whitespace-nowrap transition-all duration-150",
              isActive
                ? "shadow-sm"
                : "border-transparent bg-muted/60 text-muted-foreground hover:-translate-y-0.5 hover:bg-muted hover:text-foreground hover:shadow-sm"
            )}
          >
            <span
              className="flex size-6 shrink-0 items-center justify-center rounded-md"
              style={isActive ? { backgroundColor: tab.fg, color: "#fff" } : { backgroundColor: tab.bg, color: tab.fg }}
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
