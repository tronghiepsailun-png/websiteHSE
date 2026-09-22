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
 *  only renders the summary text and the page/viewAll navigation.
 *
 *  Two modes: URL mode (`basePath` + `searchParams`, renders Links — the default for pages whose
 *  row set comes from query params) and controlled mode (`onChange`, renders buttons — for tables
 *  whose rows are filtered in the client, where a URL page number would desync from the filter). */
export function TablePagination({
  total,
  page,
  pageSize,
  viewAll,
  unitLabelKey,
  basePath,
  searchParams,
  hash,
  onChange,
}: {
  total: number;
  page: number;
  pageSize: number;
  viewAll: boolean;
  unitLabelKey: DictionaryKey;
  /** URL mode: route the footer's links point at, e.g. "/incidents". */
  basePath?: string;
  /** URL mode: the page's current query params (plain object — safe to pass from a Server
   *  Component), preserved as-is on every page/viewAll link except the one param being changed. */
  searchParams?: Record<string, string | string[] | undefined>;
  hash?: string;
  /** Controlled mode: called with the next page/viewAll state instead of navigating. */
  onChange?: (next: { page: number; viewAll: boolean }) => void;
}) {
  const t = useT();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null; // everything already fits on one screen — nothing to page through

  const from = viewAll ? 1 : (page - 1) * pageSize + 1;
  const to = viewAll ? total : Math.min(page * pageSize, total);
  const unit = t(unitLabelKey);

  // In URL mode hrefs are built here (not passed in as functions) — a function prop can't cross
  // the Server → Client Component boundary, only plain serializable data can.
  function buildHref(overrides: Record<string, string | undefined>) {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams ?? {})) {
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

  // Plain render helpers, not components — a component declared inside the body would be a new
  // type on every render and remount its subtree.
  function renderStep(key: string, to: number, disabled: boolean, label: string) {
    const className = cn(buttonVariants({ variant: "outline", size: "sm" }), disabled && "pointer-events-none opacity-40");
    if (onChange) {
      return (
        <button key={key} type="button" disabled={disabled} className={className} onClick={() => onChange({ page: to, viewAll: false })}>
          {label}
        </button>
      );
    }
    return (
      <Link
        key={key}
        href={buildHref({ page: String(to), viewAll: undefined })}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : undefined}
        className={className}
      >
        {label}
      </Link>
    );
  }

  function renderPageNumber(p: number) {
    const className = buttonVariants({ variant: p === page ? "default" : "outline", size: "icon-sm" });
    if (onChange) {
      return (
        <button key={p} type="button" className={className} onClick={() => onChange({ page: p, viewAll: false })}>
          {p}
        </button>
      );
    }
    return (
      <Link key={p} href={buildHref({ page: String(p), viewAll: undefined })} className={className}>
        {p}
      </Link>
    );
  }

  const viewAllLabel = viewAll ? t("common.table.collapse") : t("common.table.viewAll");
  const viewAllClassName = buttonVariants({ variant: "outline", size: "sm" });

  return (
    <div className="flex flex-col gap-2 border-t px-1 pt-3 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm text-muted-foreground">
        {viewAll ? t("common.table.showingAll", { total, unit }) : t("common.table.showingRange", { from, to, total, unit })}
      </span>
      <div className="flex flex-wrap items-center gap-1">
        {!viewAll && (
          <>
            {renderStep("prev", Math.max(1, page - 1), page <= 1, t("common.table.prev"))}
            {getPageNumbers(page, totalPages).map((p, i) =>
              p === "..." ? (
                <span key={`ellipsis-${i}`} className="px-1 text-sm text-muted-foreground">
                  …
                </span>
              ) : (
                renderPageNumber(p)
              )
            )}
            {renderStep("next", Math.min(totalPages, page + 1), page >= totalPages, t("common.table.next"))}
          </>
        )}
        {onChange ? (
          <button type="button" className={viewAllClassName} onClick={() => onChange({ page: 1, viewAll: !viewAll })}>
            {viewAllLabel}
          </button>
        ) : (
          <Link href={viewAll ? buildHref({ viewAll: undefined, page: "1" }) : buildHref({ viewAll: "1", page: undefined })} className={viewAllClassName}>
            {viewAllLabel}
          </Link>
        )}
      </div>
    </div>
  );
}
