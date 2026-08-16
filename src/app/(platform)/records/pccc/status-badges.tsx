"use client";

import { Badge } from "@/components/ui/badge";
import { useT } from "@/lib/i18n/locale-context";
import type { DictionaryKey } from "@/lib/i18n/translate";
import type { DataStatus, ExpiryStatus } from "@/server/records";

const DATA_STATUS_CLASS: Record<DataStatus, string> = {
  sufficient: "border-green-500/30 text-green-600 dark:text-green-400",
  needs_update: "border-amber-500/30 text-amber-600 dark:text-amber-400",
  missing: "border-destructive/30 text-destructive",
  not_applicable: "",
};

const EXPIRY_STATUS_CLASS: Record<ExpiryStatus, string> = {
  valid: "border-green-500/30 text-green-600 dark:text-green-400",
  expiring_soon: "border-amber-500/30 text-amber-600 dark:text-amber-400",
  expired: "border-destructive/30 text-destructive",
  non_periodic: "",
};

export function DataStatusBadge({ status }: { status: DataStatus }) {
  const t = useT();
  return (
    <Badge variant={status === "not_applicable" ? "secondary" : "outline"} className={DATA_STATUS_CLASS[status]}>
      {t(`records.dataStatus.${status}` as DictionaryKey)}
    </Badge>
  );
}

export function ExpiryStatusBadge({ status }: { status: ExpiryStatus }) {
  const t = useT();
  return (
    <Badge variant={status === "non_periodic" ? "secondary" : "outline"} className={EXPIRY_STATUS_CLASS[status]}>
      {t(`records.expiryStatus.${status}` as DictionaryKey)}
    </Badge>
  );
}
