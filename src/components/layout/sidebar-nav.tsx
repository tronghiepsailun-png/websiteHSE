"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_SECTIONS, type NavItem } from "@/lib/nav";
import { useT } from "@/lib/i18n/locale-context";
import type { DictionaryKey } from "@/lib/i18n/translate";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

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

// Distinguishes a single click (toggle just this group) from a double click (toggle every
// group) on the same header button, without the single-click action ever firing and then
// being undone — the single-click callback is delayed just long enough to be cancelled if a
// second click arrives in time.
function useSingleOrDoubleClick(onSingle: () => void, onDouble: () => void, delay = 250) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  return () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
      onDouble();
    } else {
      timer.current = setTimeout(() => {
        timer.current = null;
        onSingle();
      }, delay);
    }
  };
}

function NavLink({
  href,
  labelKey,
  icon: Icon,
  onNavigate,
  activeHref,
  collapsed,
  compact,
}: NavItem & { onNavigate?: () => void; activeHref: string | null; groupLabelKey?: DictionaryKey; collapsed?: boolean; compact?: boolean }) {
  const t = useT();
  const active = href === activeHref;

  const link = (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-2.5 rounded-md text-sm font-medium outline-none transition-colors",
        compact ? "py-1" : "py-1.5",
        collapsed ? "justify-center px-2" : "pr-3 pl-2",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/80 hover:bg-white/10 hover:text-sidebar-foreground"
      )}
    >
      <Icon className="size-4 shrink-0" />
      {!collapsed && <span className="truncate">{t(labelKey)}</span>}
    </Link>
  );

  if (!collapsed) return link;

  return (
    <Tooltip>
      <TooltipTrigger render={link} />
      <TooltipContent side="right">{t(labelKey)}</TooltipContent>
    </Tooltip>
  );
}

// Sub-items are always rendered — nothing is hidden behind hover — but each group can still
// be collapsed by clicking its header, so a long nav stays manageable without ever hiding
// where the user currently is: a group whose route is active is always forced open, even if
// the user had collapsed it, and re-collapsing it snaps back open the moment it's active again.
// A single click on any header toggles just that group; a double click toggles every group at
// once — no separate "expand all"/"collapse all" buttons needed.
function NavGroup({
  labelKey,
  items,
  onNavigate,
  activeHref,
  collapsed,
  onToggle,
  onToggleAll,
  railCollapsed,
  compact,
}: {
  labelKey?: DictionaryKey;
  items: NavItem[];
  onNavigate?: () => void;
  activeHref: string | null;
  collapsed: boolean;
  onToggle: () => void;
  onToggleAll: () => void;
  railCollapsed?: boolean;
  compact?: boolean;
}) {
  const t = useT();
  const handleClick = useSingleOrDoubleClick(onToggle, onToggleAll);
  if (items.length === 0) return null;
  const isActiveGroup = items.some((item) => item.href === activeHref);
  const open = railCollapsed || isActiveGroup || !collapsed;

  return (
    <div className="flex flex-col gap-0.5">
      {labelKey && !railCollapsed ? (
        <button
          type="button"
          onClick={handleClick}
          className={cn(
            "flex items-center justify-between rounded-md px-3 text-xs font-semibold tracking-wide uppercase transition-colors outline-none",
            compact ? "py-0.5" : "py-1",
            "hover:bg-white/10 focus-visible:ring-3 focus-visible:ring-ring/50",
            isActiveGroup ? "text-sidebar-foreground" : "text-sidebar-foreground/60"
          )}
        >
          {t(labelKey)}
          <ChevronDown className={cn("size-3.5 shrink-0 transition-transform duration-150", open ? "rotate-0" : "-rotate-90")} />
        </button>
      ) : null}
      <div className="grid min-h-0 transition-[grid-template-rows] duration-150 ease-out" style={{ gridTemplateRows: open ? "1fr" : "0fr" }}>
        <div className={cn("flex min-h-0 flex-col gap-0.5 overflow-hidden", !railCollapsed && "pl-1")}>
          {items.map((item) => (
            <NavLink key={item.href} {...item} onNavigate={onNavigate} activeHref={activeHref} groupLabelKey={labelKey} collapsed={railCollapsed} compact={compact} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function SidebarNav({
  onNavigate,
  collapsed,
  compact,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
  compact?: boolean;
}) {
  const activeHref = useActiveHref();
  // Every module is always listed — a sub-account without the view permission for one just
  // sees a friendly "ask your admin" message on click (see NoPermissionState), rather than
  // the module disappearing from the sidebar entirely.
  const visibleSections = NAV_SECTIONS;
  const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(new Set());

  function toggleGroup(key: string) {
    setCollapsedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // "All expanded" is judged only among groups that can actually be collapsed — the group
  // holding the current page is always forced open, so it shouldn't keep this permanently
  // stuck on "collapse all".
  function toggleAll() {
    setCollapsedKeys((prev) => {
      const collapsible = visibleSections.filter((s) => !s.items.some((i) => i.href === activeHref));
      const allCollapsed = collapsible.length > 0 && collapsible.every((s) => prev.has(s.labelKey));
      return allCollapsed ? new Set() : new Set(visibleSections.map((s) => s.labelKey));
    });
  }

  return (
    <nav className={cn("flex flex-col p-3", compact ? "gap-1.5" : "gap-3", collapsed && "items-center px-1.5")}>
      {visibleSections.map((section) => (
        <NavGroup
          key={section.labelKey}
          labelKey={section.labelKey}
          items={section.items}
          onNavigate={onNavigate}
          activeHref={activeHref}
          collapsed={collapsedKeys.has(section.labelKey)}
          onToggle={() => toggleGroup(section.labelKey)}
          onToggleAll={toggleAll}
          railCollapsed={collapsed}
          compact={compact}
        />
      ))}
    </nav>
  );
}
