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

// investigating/closed map cleanly onto the shared warning/success risk tones.
const STATUS_VARIANTS: Record<string, string> = {
  investigating: STATUS_FILLED_CLASS.warning,
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
