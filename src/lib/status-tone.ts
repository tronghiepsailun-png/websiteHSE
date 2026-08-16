/**
 * Shared semantic status-color tones for the HSE Design System. `critical` reuses the
 * existing `--destructive` token (already the app-wide "danger" color — a delete
 * button and an overdue CAPA should be the same red, not two different reds).
 * `success`/`warning` are the two new tokens added in globals.css. `neutral` reuses
 * the existing muted/border tokens.
 *
 * This is for RISK/STATUS meaning only (is this okay / needs attention / urgent).
 * It is not a general-purpose color picker — categorical accents that don't represent
 * risk (e.g. the Incidents dashboard's per-KPI brand colors) intentionally stay as
 * literal Tailwind classes and should not be forced through this file.
 */
export type StatusTone = "success" | "warning" | "critical" | "neutral";

/** Outline pill: transparent bg, colored border + text. Used by status/expiry badges. */
export const STATUS_OUTLINE_CLASS: Record<StatusTone, string> = {
  success: "border-success/30 text-success",
  warning: "border-warning/30 text-warning",
  critical: "border-destructive/30 text-destructive",
  neutral: "",
};

/** Filled pill: tinted bg, colored text, no border. Used by workflow-status badges. */
export const STATUS_FILLED_CLASS: Record<StatusTone, string> = {
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  critical: "bg-destructive/10 text-destructive",
  neutral: "bg-muted text-muted-foreground",
};

/** KPI-card accent tile: card border + icon background + icon color. */
export const STATUS_TILE_CLASS: Record<StatusTone, { border: string; iconBg: string; iconFg: string }> = {
  success: { border: "border-success/20", iconBg: "bg-success/10", iconFg: "text-success" },
  warning: { border: "border-warning/20", iconBg: "bg-warning/10", iconFg: "text-warning" },
  critical: { border: "border-destructive/20", iconBg: "bg-destructive/10", iconFg: "text-destructive" },
  neutral: { border: "", iconBg: "bg-muted", iconFg: "text-muted-foreground" },
};

/** Bare text color only — inline numbers/labels with no background of their own. */
export const STATUS_TEXT_CLASS: Record<StatusTone, string> = {
  success: "text-success",
  warning: "text-warning",
  critical: "text-destructive",
  neutral: "text-muted-foreground",
};

/** Banner/callout color (border + tinted bg + text) — pair with your own padding/radius. */
export const STATUS_BANNER_CLASS: Record<StatusTone, string> = {
  success: "border-success/30 bg-success/10 text-success",
  warning: "border-warning/30 bg-warning/10 text-warning",
  critical: "border-destructive/30 bg-destructive/10 text-destructive",
  neutral: "border-border bg-muted text-muted-foreground",
};
