import { cn } from "@/lib/utils";
import { T } from "@/components/i18n/t";
import type { DictionaryKey } from "@/lib/i18n/translate";
import { type ReportView } from "./report-view";

const TABS: { value: ReportView; labelKey: DictionaryKey }[] = [
  { value: "detail", labelKey: "incidents.tabs.detail" },
  { value: "stats", labelKey: "incidents.tabs.stats" },
  { value: "score", labelKey: "incidents.tabs.score" },
  { value: "deduction", labelKey: "incidents.tabs.deduction" },
  { value: "kpi", labelKey: "incidents.tabs.kpi" },
];

/** Deliberately a plain <a>, not next/link — Next's client Router Cache can keep serving
 *  whatever this exact URL rendered the last time it was visited in this tab (a documented
 *  "back/forward cache" behavior that isn't controlled by the staleTimes config), so switching
 *  tabs via client-side navigation could show stale aggregates after an incident is added/edited
 *  elsewhere, even though the server itself always has fresh data. A plain anchor forces a full
 *  page load every time, guaranteeing this report data is never stale. */
export function ReportTabs({ active }: { active: ReportView }) {
  return (
    <div className="inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-lg bg-muted p-[3px]">
      {TABS.map((tab) => {
        const href = tab.value === "detail" ? "/incidents" : `/incidents?view=${tab.value}`;
        return (
          <a
            key={tab.value}
            href={href}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
              active === tab.value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <T k={tab.labelKey} />
          </a>
        );
      })}
    </div>
  );
}
