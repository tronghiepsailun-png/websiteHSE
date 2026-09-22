import Link from "next/link";
import { LayoutGrid, Table2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { t, type Locale } from "@/lib/i18n/translate";

/** Table ↔ Kanban switch. A plain link (not a client toggle) so the chosen view survives a
 *  reload and can be shared/bookmarked, and so the server renders only the view in use. */
export function ViewModeTabs({
  active,
  basePath,
  searchParams,
  locale,
}: {
  active: "table" | "board";
  basePath: string;
  searchParams: Record<string, string | string[] | undefined>;
  locale: Locale;
}) {
  function href(view: "table" | "board") {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (typeof value !== "string" || key === "view") continue;
      next.set(key, value);
    }
    if (view === "board") next.set("view", "board");
    const qs = next.toString();
    return `${basePath}${qs ? `?${qs}` : ""}`;
  }

  const options = [
    { view: "table" as const, icon: Table2, label: t(locale, "kanban.viewTable") },
    { view: "board" as const, icon: LayoutGrid, label: t(locale, "kanban.viewBoard") },
  ];

  return (
    <div className="inline-flex items-center gap-1 rounded-lg border bg-card p-1">
      {options.map(({ view, icon: Icon, label }) => (
        <Link
          key={view}
          href={href(view)}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm transition-colors",
            active === view ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
          )}
        >
          <Icon className="size-4" />
          {label}
        </Link>
      ))}
    </div>
  );
}
