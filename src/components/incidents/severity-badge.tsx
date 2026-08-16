"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/locale-context";
import type { DictionaryKey } from "@/lib/i18n/translate";
import { STATUS_FILLED_CLASS } from "@/lib/status-tone";

export function SeverityBadge({ name, colorHex }: { name: string; colorHex?: string | null }) {
  const color = colorHex ?? "#6b7280";
  return (
    <Badge variant="outline" className="gap-1.5 border-transparent" style={{ backgroundColor: `${color}1a`, color }}>
      <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
      {name}
    </Badge>
  );
}

// open/action_pending are workflow-stage colors (not risk tones), so they stay literal;
// investigating/closed map cleanly onto the shared warning/success risk tones.
const STATUS_VARIANTS: Record<string, string> = {
  open: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  investigating: STATUS_FILLED_CLASS.warning,
  action_pending: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  closed: STATUS_FILLED_CLASS.success,
};

export function IncidentStatusBadge({ status }: { status: string }) {
  const t = useT();
  const key = `status.incident.${status}` as DictionaryKey;
  return (
    <Badge variant="outline" className={cn("border-transparent", STATUS_VARIANTS[status] ?? "bg-muted text-muted-foreground")}>
      {t(key)}
    </Badge>
  );
}

// "overdue" now shares the same red as every other critical/destructive indicator in
// the app (it was previously a separate hardcoded red-500, its own one-off shade).
const CAPA_STATUS_VARIANTS: Record<string, string> = {
  open: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  in_progress: STATUS_FILLED_CLASS.warning,
  completed: STATUS_FILLED_CLASS.success,
  overdue: STATUS_FILLED_CLASS.critical,
  closed: STATUS_FILLED_CLASS.neutral,
};

export function CapaStatusBadge({ status }: { status: string }) {
  const t = useT();
  const key = `status.capa.${status}` as DictionaryKey;
  return (
    <Badge variant="outline" className={cn("border-transparent", CAPA_STATUS_VARIANTS[status] ?? "bg-muted text-muted-foreground")}>
      {t(key)}
    </Badge>
  );
}
