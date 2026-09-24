"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { NAV_SECTIONS, ADMIN_NAV_ITEMS } from "@/lib/nav";
import { useT } from "@/lib/i18n/locale-context";
import type { DictionaryKey } from "@/lib/i18n/translate";

// Same "longest matching href wins" rule as sidebar-nav.tsx's useActiveHref — a route like
// "/employees/[id]/edit" has no nav entry of its own, so it resolves to its nearest ancestor
// ("/employees") rather than showing nothing or a raw path segment.
function findBestMatch<T extends { href: string; labelKey: DictionaryKey }>(pathname: string, items: T[]): T | null {
  let best: T | null = null;
  for (const item of items) {
    const matches = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
    if (matches && (best === null || item.href.length > best.href.length)) best = item;
  }
  return best;
}

function useBreadcrumbTrail() {
  const pathname = usePathname();

  return useMemo(() => {
    if (pathname.startsWith("/admin") || pathname === "/settings" || ADMIN_NAV_ITEMS.some((i) => pathname.startsWith(i.href))) {
      const match = findBestMatch(pathname, ADMIN_NAV_ITEMS);
      return match ? [{ href: "/settings", labelKey: "nav.settings" as const }, match] : [{ href: "/settings", labelKey: "nav.settings" as const }];
    }
    const allItems = NAV_SECTIONS.flatMap((s) => s.items);
    const match = findBestMatch(pathname, allItems);
    if (!match || match.href === "/") return [];
    return [{ href: "/", labelKey: "nav.dashboard" as const }, match];
  }, [pathname]);
}

/** Keeps the browser tab title in step with the current module ("Sự cố · 24HSE") — every page
 *  used to show the same generic app title, which made multiple open tabs indistinguishable. */
export function DocumentTitle() {
  const trail = useBreadcrumbTrail();
  const t = useT();
  const current = trail.length > 0 ? t(trail[trail.length - 1].labelKey) : t("nav.dashboard");

  useEffect(() => {
    document.title = `${current} · 24HSE`;
  }, [current]);

  return null;
}

export function Breadcrumb() {
  const trail = useBreadcrumbTrail();
  const t = useT();

  if (trail.length === 0) return null;

  return (
    <nav className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
      {trail.map((crumb, i) => {
        const isLast = i === trail.length - 1;
        return (
          <span key={crumb.href} className="flex min-w-0 items-center gap-1.5">
            {i > 0 && <ChevronRight className="size-3.5 shrink-0" />}
            {isLast ? (
              <span className="truncate font-medium text-foreground">{t(crumb.labelKey)}</span>
            ) : (
              <Link href={crumb.href} className="truncate transition-colors hover:text-foreground">
                {t(crumb.labelKey)}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
