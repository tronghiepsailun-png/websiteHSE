"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_SECTIONS, canSee, type NavItem } from "@/lib/nav";
import { useT } from "@/lib/i18n/locale-context";
import type { DictionaryKey } from "@/lib/i18n/translate";

function isItemActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function NavLink({ href, labelKey, icon: Icon, onNavigate }: NavItem & { onNavigate?: () => void }) {
  const pathname = usePathname();
  const t = useT();
  const active = isItemActive(pathname, href);

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium outline-none transition-colors",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon className="size-4 shrink-0" />
      {t(labelKey)}
    </Link>
  );
}

// Only the group header is visible by default — hovering OR keyboard-focusing any
// link inside the group reveals it (pure CSS, via a named group + grid-template-rows
// animation, no JS state). The focus-within variant is what makes this reachable by
// Tab alone: links stay in the DOM (just clipped to 0 height) so they're still
// focusable, and focusing one expands its group automatically — a mouse is never
// required. The header itself is still highlighted whenever the active route belongs
// to this group, so the current location stays visible without needing to hover.
function NavGroup({ labelKey, items, onNavigate }: { labelKey?: DictionaryKey; items: NavItem[]; onNavigate?: () => void }) {
  const t = useT();
  const pathname = usePathname();
  if (items.length === 0) return null;
  const isActiveGroup = items.some((item) => isItemActive(pathname, item.href));

  return (
    <div className="group/nav flex flex-col gap-1">
      {labelKey && (
        <p
          className={cn(
            "px-3 text-xs font-semibold uppercase tracking-wide transition-colors",
            isActiveGroup ? "text-foreground" : "text-muted-foreground"
          )}
        >
          {t(labelKey)}
        </p>
      )}
      <div className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-150 ease-out group-hover/nav:grid-rows-[1fr] group-focus-within/nav:grid-rows-[1fr]">
        <div className="flex flex-col gap-1 overflow-hidden">
          {items.map((item) => (
            <NavLink key={item.href} {...item} onNavigate={onNavigate} />
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
  return (
    <nav className="flex flex-col gap-4 p-3">
      {NAV_SECTIONS.map((section) => (
        <NavGroup
          key={section.labelKey}
          labelKey={section.labelKey}
          items={section.items.filter((i) => canSee(i, permissionKeys))}
          onNavigate={onNavigate}
        />
      ))}
    </nav>
  );
}
