"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/locale-context";
import type { DictionaryKey } from "@/lib/i18n/translate";
import type { DataStatus, ExpiryStatus } from "@/server/records";
import { STATUS_OUTLINE_CLASS } from "@/lib/status-tone";

const DATA_STATUS_CLASS: Record<DataStatus, string> = {
  sufficient: STATUS_OUTLINE_CLASS.success,
  needs_update: STATUS_OUTLINE_CLASS.warning,
  not_applicable: STATUS_OUTLINE_CLASS.neutral,
};

const EXPIRY_STATUS_CLASS: Record<ExpiryStatus, string> = {
  valid: STATUS_OUTLINE_CLASS.success,
  expiring_soon: STATUS_OUTLINE_CLASS.warning,
  expired: STATUS_OUTLINE_CLASS.critical,
  non_periodic: STATUS_OUTLINE_CLASS.neutral,
};

export function DataStatusBadge({ status, className }: { status: DataStatus; className?: string }) {
  const t = useT();
  return (
    <Badge variant={status === "not_applicable" ? "secondary" : "outline"} className={cn(DATA_STATUS_CLASS[status], className)}>
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
