"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/locale-context";
import type { DictionaryKey } from "@/lib/i18n/translate";

export function SeverityBadge({ name, colorHex }: { name: string; colorHex?: string | null }) {
  const color = colorHex ?? "#6b7280";
  return (
    <Badge variant="outline" className="gap-1.5 border-transparent" style={{ backgroundColor: `${color}1a`, color }}>
      <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
      {name}
    </Badge>
  );
}

const STATUS_VARIANTS: Record<string, string> = {
  open: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  investigating: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  action_pending: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  closed: "bg-green-500/10 text-green-600 dark:text-green-400",
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

const CAPA_STATUS_VARIANTS: Record<string, string> = {
  open: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  in_progress: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  completed: "bg-green-500/10 text-green-600 dark:text-green-400",
  overdue: "bg-red-500/10 text-red-600 dark:text-red-400",
  closed: "bg-muted text-muted-foreground",
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
