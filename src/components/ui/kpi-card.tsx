import { Lock } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { T } from "@/components/i18n/t";
import { cn } from "@/lib/utils";
import { STATUS_TILE_CLASS, type StatusTone } from "@/lib/status-tone";
import type { DictionaryKey } from "@/lib/i18n/translate";

// Standard fixed width for every mobile KPI row (used with HorizontalScroll). The label
// below never truncates — it wraps instead — so this width doesn't need to fit any
// specific longest label on one line, just look consistent across every module. Slightly
// wider than a plain stat chip on purpose — a fixed-width card reads better against a
// horizontal-scroll strip when it isn't too narrow.
export const KPI_CARD_WIDTH_CLASS = "w-[168px] shrink-0 md:w-auto md:shrink";

/** Shared KPI tile: icon badge top-right, label (wraps, never cut off) + big value top-left.
 *  Either pass `tone` (risk/status color, from the shared design system) or `iconBg`/`iconFg`
 *  (a literal brand accent color for a non-risk categorical stat, e.g. the dashboard's per-module
 *  colors) — never both. `locked` swaps the value for a "no permission" placeholder. */
export function KpiCard({
  labelKey,
  value,
  icon: Icon,
  tone,
  iconBg,
  iconFg,
  locked,
  className,
  valueClassName,
}: {
  labelKey: DictionaryKey;
  value: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  tone?: StatusTone;
  iconBg?: string;
  iconFg?: string;
  locked?: boolean;
  className?: string;
  /** Override the value's text size — e.g. a smaller size for a KPI whose value is a long
   *  string (a compound currency amount) rather than a short number. Default matches the
   *  size real mobile dashboards use for a dense stat tile (not the larger desktop scale). */
  valueClassName?: string;
}) {
  const tile = tone ? STATUS_TILE_CLASS[tone] : null;
  return (
    // `h-full` always applied (not left to callers to remember) — inside a flex/grid row
    // with default stretch, siblings otherwise sit at their own intrinsic height and a
    // longer-wrapping label makes only that one card look taller than the rest. The hover
    // lift/glow is on every KPI card by default (not just the ones a caller remembered to
    // opt into) — consistency across modules was the whole point of having one shared component.
    <Card
      className={cn(
        "h-full transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:ring-2 hover:ring-primary/50",
        tile?.border,
        className
      )}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
        <div className="min-w-0">
          <CardDescription className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            <T k={labelKey} />
          </CardDescription>
          {locked ? (
            <p className="text-xs text-muted-foreground/70">
              <T k="common.noPermissionTitle" />
            </p>
          ) : (
            <CardTitle className={valueClassName ?? "text-xl leading-none font-bold"}>{value}</CardTitle>
          )}
        </div>
        <div
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg",
            locked ? "bg-muted text-muted-foreground" : cn(tile?.iconBg, tile?.iconFg)
          )}
          style={!locked && !tile ? { backgroundColor: iconBg, color: iconFg } : undefined}
        >
          {locked ? <Lock className="size-4" /> : <Icon className="size-4" />}
        </div>
      </CardHeader>
    </Card>
  );
}
