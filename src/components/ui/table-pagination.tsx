"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/locale-context";
import type { DictionaryKey } from "@/lib/i18n/translate";

/** Windows page numbers around the current page (plus first/last), with "…" gaps —
 *  e.g. for page 10 of 40: 1 2 … 9 10 11 … 39 40. */
function getPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const keep = new Set<number>([1, 2, total - 1, total, current - 1, current, current + 1]);
  const sorted = [...keep].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const result: (number | "...")[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) result.push("...");
    result.push(p);
    prev = p;
  }
  return result;
}

/** Shared "20 rows by default, with page numbers + a full View All toggle" footer for every
 *  large data table in the platform (incidents, employees, CAPA, ...). Purely presentational —
 *  the caller is responsible for actually slicing/fetching the visible rows; this component
 *  only renders the summary text and the page/viewAll navigation links. */
export function TablePagination({
  total,
  page,
  pageSize,
  viewAll,
  unitLabelKey,
  basePath,
  searchParams,
  hash,
}: {
  total: number;
  page: number;
  pageSize: number;
  viewAll: boolean;
  unitLabelKey: DictionaryKey;
  /** Route the footer's links point at, e.g. "/incidents". */
  basePath: string;
  /** The page's current query params (plain object — safe to pass from a Server Component),
   *  preserved as-is on every page/viewAll link except the one param being changed. */
  searchParams: Record<string, string | string[] | undefined>;
  hash?: string;
}) {
  const t = useT();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null; // everything already fits on one screen — nothing to page through

  const from = viewAll ? 1 : (page - 1) * pageSize + 1;
  const to = viewAll ? total : Math.min(page * pageSize, total);
  const unit = t(unitLabelKey);

  // Hrefs are built here (not passed in as functions) — a function prop can't cross the
  // Server → Client Component boundary, only plain serializable data can.
  function buildHref(overrides: Record<string, string | undefined>) {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (typeof value !== "string") continue;
      next.set(key, value);
    }
    for (const [key, value] of Object.entries(overrides)) {
      if (value === undefined) next.delete(key);
      else next.set(key, value);
    }
    const qs = next.toString();
    return `${basePath}${qs ? `?${qs}` : ""}${hash ?? ""}`;
  }
  const pageHref = (p: number) => buildHref({ page: String(p), viewAll: undefined });
  const viewAllHref = buildHref({ viewAll: "1", page: undefined });
  const collapseHref = buildHref({ viewAll: undefined, page: "1" });

  return (
    <div className="flex flex-col gap-2 border-t px-1 pt-3 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm text-muted-foreground">
        {viewAll ? t("common.table.showingAll", { total, unit }) : t("common.table.showingRange", { from, to, total, unit })}
      </span>
      <div className="flex flex-wrap items-center gap-1">
        {!viewAll && (
          <>
            <Link
              href={pageHref(Math.max(1, page - 1))}
              aria-disabled={page <= 1}
              tabIndex={page <= 1 ? -1 : undefined}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), page <= 1 && "pointer-events-none opacity-40")}
            >
              {t("common.table.prev")}
            </Link>
            {getPageNumbers(page, totalPages).map((p, i) =>
              p === "..." ? (
                <span key={`ellipsis-${i}`} className="px-1 text-sm text-muted-foreground">
                  …
                </span>
              ) : (
                <Link key={p} href={pageHref(p)} className={buttonVariants({ variant: p === page ? "default" : "outline", size: "icon-sm" })}>
                  {p}
                </Link>
              )
            )}
            <Link
              href={pageHref(Math.min(totalPages, page + 1))}
              aria-disabled={page >= totalPages}
              tabIndex={page >= totalPages ? -1 : undefined}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), page >= totalPages && "pointer-events-none opacity-40")}
            >
              {t("common.table.next")}
            </Link>
          </>
        )}
        <Link href={viewAll ? collapseHref : viewAllHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
          {viewAll ? t("common.table.collapse") : t("common.table.viewAll")}
        </Link>
      </div>
    </div>
  );
}
