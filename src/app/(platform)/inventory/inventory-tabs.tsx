import Link from "next/link";
import { Boxes, PackageMinus, PackagePlus, ClipboardList } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { T } from "@/components/i18n/t";
import type { DictionaryKey } from "@/lib/i18n/translate";
import { HorizontalScroll } from "@/components/ui/horizontal-scroll";

export type InventoryTabKey = "stock" | "issuance" | "stockin" | "catalog";

const TABS: { key: InventoryTabKey; href: string; labelKey: DictionaryKey; icon: LucideIcon; fg: string; bg: string }[] = [
  { key: "stock", href: "/inventory?view=stock", labelKey: "inventory.tabs.stock", icon: Boxes, fg: "#ea580c", bg: "#ffedd5" },
  { key: "issuance", href: "/inventory?view=issuance", labelKey: "inventory.tabs.issuance", icon: PackageMinus, fg: "#dc2626", bg: "#fee2e2" },
  { key: "stockin", href: "/inventory?view=stockin", labelKey: "inventory.tabs.stockIn", icon: PackagePlus, fg: "#16a34a", bg: "#dcfce7" },
  { key: "catalog", href: "/inventory/catalog", labelKey: "inventory.tabs.catalog", icon: ClipboardList, fg: "#2563eb", bg: "#dbeafe" },
];

/** Same colored-pill tab pattern as Violations/Incidents (ViolationsTabs / ReportTabs) — a
 *  plain server component here since Inventory's "tabs" are just a `view` search param on one
 *  route (plus one real route for the catalog), and the active tab is already known server-side
 *  from that same value the page uses to pick which report to render. */
export function InventoryTabs({ active, canManageCatalog }: { active: InventoryTabKey; canManageCatalog: boolean }) {
  const tabs = TABS.filter((tab) => tab.key !== "catalog" || canManageCatalog);
  return (
    <HorizontalScroll className="flex max-w-full flex-nowrap items-stretch gap-2">
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        const Icon = tab.icon;
        return (
          <Link
            key={tab.key}
            href={tab.href}
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
          </Link>
        );
      })}
    </HorizontalScroll>
  );
}
