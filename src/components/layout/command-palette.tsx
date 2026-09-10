"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, IdCard } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { NAV_SECTIONS, ADMIN_NAV_ITEMS, canSee, type NavItem } from "@/lib/nav";
import { useT } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";
import { searchEmployeesAction } from "@/components/employees/employee-search-actions";
import type { EmployeeLite } from "@/server/employees";

type ResultRow = { kind: "nav"; item: NavItem; label: string } | { kind: "employee"; employee: EmployeeLite };

// Global Ctrl/Cmd+K navigator — flattens every nav item the user can actually see (main
// sidebar + admin hub) into one searchable list, so a >20-route app stays reachable without
// clicking through nested menus. Read-only navigation only: it never triggers a mutation.
export function CommandPalette({ permissionKeys }: { permissionKeys: string[] | null }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [employeeResults, setEmployeeResults] = useState<EmployeeLite[]>([]);
  const router = useRouter();
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);

  const visibleItems = useMemo(() => {
    // Main-sidebar modules are always listed, matching SidebarNav — clicking into one without
    // the view permission shows a friendly message rather than the item disappearing. The
    // admin hub (Settings) items keep the real permission filter since that hub is a separate,
    // more sensitive area reached through its own gated menu entry.
    const always: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);
    const adminOnly = ADMIN_NAV_ITEMS.filter((item) => canSee(item, permissionKeys));
    const seen = new Set<string>();
    return [...always, ...adminOnly].filter((item) => {
      if (seen.has(item.href)) return false;
      seen.add(item.href);
      return true;
    });
  }, [permissionKeys]);

  const navResults = useMemo(() => {
    const labeled = visibleItems.map((item) => ({ item, label: t(item.labelKey) }));
    const q = query.trim().toLowerCase();
    if (!q) return labeled;
    return labeled.filter(({ label }) => label.toLowerCase().includes(q));
  }, [visibleItems, query, t]);

  // Employee lookup is a separate, debounced server round trip (unlike nav results, which
  // filter a small in-memory list) — only fires once the user pauses typing, and is silently
  // dropped if the account lacks EMPLOYEE_VIEW rather than erroring the whole palette.
  useEffect(() => {
    const q = query.trim();
    if (!open || q.length === 0) {
      setEmployeeResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      searchEmployeesAction(q)
        .then((rows) => {
          if (!cancelled) setEmployeeResults(rows);
        })
        .catch(() => {
          if (!cancelled) setEmployeeResults([]);
        });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, query]);

  const combinedResults = useMemo<ResultRow[]>(() => {
    const navRows: ResultRow[] = navResults.map(({ item, label }) => ({ kind: "nav", item, label }));
    const employeeRows: ResultRow[] = employeeResults.map((employee) => ({ kind: "employee", employee }));
    return [...navRows, ...employeeRows];
  }, [navResults, employeeResults]);

  useEffect(() => {
    function onKeyDown(e: globalThis.KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setEmployeeResults([]);
    setActiveIndex(0);
    const raf = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  function goToRow(row: ResultRow) {
    if (row.kind === "nav") go(row.item.href);
    else go(`/employees?q=${encodeURIComponent(row.employee.employeeCode)}`);
  }

  // Attached to window (not the input's onKeyDown) so it fires the same way the Ctrl+K
  // opener does — reliable regardless of exactly which node currently holds DOM focus.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, combinedResults.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const target = combinedResults[activeIndex];
        if (target) goToRow(target);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, combinedResults, activeIndex]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted md:flex"
      >
        <Search className="size-3.5" />
        <span>{t("commandPalette.trigger")}</span>
        <kbd className="ml-4 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium">Ctrl K</kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          className="top-24 max-w-lg -translate-y-0 gap-0 overflow-hidden p-0"
        >
          <DialogTitle className="sr-only">{t("commandPalette.title")}</DialogTitle>
          <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("commandPalette.placeholder")}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">Esc</kbd>
          </div>
          <div className="thin-scrollbar max-h-80 overflow-y-auto p-1.5">
            {combinedResults.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">{t("commandPalette.empty")}</p>
            ) : (
              <>
                {navResults.length > 0 && (
                  <p className="px-2.5 pt-1.5 pb-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                    {t("commandPalette.groupPages")}
                  </p>
                )}
                {navResults.map(({ item, label }, i) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.href}
                      type="button"
                      onMouseEnter={() => setActiveIndex(i)}
                      onClick={() => go(item.href)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                        i === activeIndex ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span className="truncate">{label}</span>
                    </button>
                  );
                })}
                {employeeResults.length > 0 && (
                  <p className="px-2.5 pt-2 pb-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                    {t("commandPalette.groupEmployees")}
                  </p>
                )}
                {employeeResults.map((employee, j) => {
                  const i = navResults.length + j;
                  return (
                    <button
                      key={employee.id}
                      type="button"
                      onMouseEnter={() => setActiveIndex(i)}
                      onClick={() => goToRow({ kind: "employee", employee })}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                        i === activeIndex ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
                      )}
                    >
                      <IdCard className="size-4 shrink-0" />
                      <span className="truncate">{employee.fullNameZh ?? employee.fullName}</span>
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground">{employee.employeeCode}</span>
                    </button>
                  );
                })}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
