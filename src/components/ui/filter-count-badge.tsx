"use client";

import { Badge } from "@/components/ui/badge";
import { useT } from "@/lib/i18n/locale-context";

/** Shown next to a filter bar's "Xóa bộ lọc" link so users can see at a glance how many
 * filters are narrowing the current list — neutral tone, not a risk indicator. */
export function FilterCountBadge({ count }: { count: number }) {
  const t = useT();
  if (count <= 0) return null;
  return <Badge variant="secondary">{t("common.filtersActive", { count })}</Badge>;
}
