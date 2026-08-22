"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_SECTIONS, canSee, type NavItem } from "@/lib/nav";
import { useT } from "@/lib/i18n/locale-context";
import type { DictionaryKey } from "@/lib/i18n/translate";

// A nav href can be a path-prefix of another (e.g. "/employees" vs. "/employees/evaluation"),
// so matching every item independently would highlight both at once on the more specific
// page. Only the single longest matching href — i.e. the most specific one — counts as active.
function useActiveHref() {
  const pathname = usePathname();
  return useMemo(() => {
    let best: string | null = null;
    for (const section of NAV_SECTIONS) {
      for (const item of section.items) {
        const matches = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
        if (matches && (best === null || item.href.length > best.length)) best = item.href;
      }
    }
    return best;
  }, [pathname]);
}

function NavLink({ href, labelKey, icon: Icon, onNavigate, activeHref }: NavItem & { onNavigate?: () => void; activeHref: string | null }) {
  const t = useT();
  const active = href === activeHref;

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "relative flex items-center gap-2.5 rounded-md py-2 pr-3 pl-4 text-sm font-medium outline-none transition-colors",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {active && <span className="absolute top-1/2 left-0 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary" />}
      <Icon className="size-4 shrink-0" />
      <span className="truncate">{t(labelKey)}</span>
    </Link>
  );
}

// Sub-items are always rendered — nothing is hidden behind hover — but each group can still
// be collapsed by clicking its header, so a long nav stays manageable without ever hiding
// where the user currently is: a group whose route is active is always forced open, even if
// the user had collapsed it, and re-collapsing it snaps back open the moment it's active again.
function NavGroup({
  labelKey,
  items,
  onNavigate,
  activeHref,
}: {
  labelKey?: DictionaryKey;
  items: NavItem[];
  onNavigate?: () => void;
  activeHref: string | null;
}) {
  const t = useT();
  const [collapsed, setCollapsed] = useState(false);
  if (items.length === 0) return null;
  const isActiveGroup = items.some((item) => item.href === activeHref);
  const open = isActiveGroup || !collapsed;

  return (
    <div className="flex flex-col gap-1">
      {labelKey ? (
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className={cn(
            "flex items-center justify-between rounded-md px-3 py-1 text-xs font-semibold tracking-wide uppercase transition-colors outline-none",
            "hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
            isActiveGroup ? "text-foreground" : "text-muted-foreground"
          )}
        >
          {t(labelKey)}
          <ChevronDown className={cn("size-3.5 shrink-0 transition-transform duration-150", open ? "rotate-0" : "-rotate-90")} />
        </button>
      ) : null}
      <div className="grid transition-[grid-template-rows] duration-150 ease-out" style={{ gridTemplateRows: open ? "1fr" : "0fr" }}>
        <div className="flex flex-col gap-0.5 overflow-hidden border-l border-sidebar-border pl-2">
          {items.map((item) => (
            <NavLink key={item.href} {...item} onNavigate={onNavigate} activeHref={activeHref} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function SidebarNav({
  permissionKeys,
  onNavigate,
}: {
  permissionKeys: string[] | null;
  onNavigate?: () => void;
}) {
  const activeHref = useActiveHref();
  return (
    <nav className="flex flex-col gap-3 p-3">
      {NAV_SECTIONS.map((section) => (
        <NavGroup
          key={section.labelKey}
          labelKey={section.labelKey}
          items={section.items.filter((i) => canSee(i, permissionKeys))}
          onNavigate={onNavigate}
          activeHref={activeHref}
        />
      ))}
    </nav>
  );
}
