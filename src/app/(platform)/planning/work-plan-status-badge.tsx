import { cn } from "@/lib/utils";
import { STATUS_FILLED_CLASS } from "@/lib/status-tone";
import type { WorkPlanStatus } from "@/server/work-plan";
import { t } from "@/lib/i18n/translate";
import type { Locale, DictionaryKey } from "@/lib/i18n/translate";

// "in_progress" is literal blue rather than a shared status-tone — matches the same
// precedent already set by CapaStatusBadge's "open" state, since the shared tone palette
// only covers success/warning/critical/neutral (risk-meaning), not a plain "active" blue.
const CLASS: Record<WorkPlanStatus, string> = {
  not_started: STATUS_FILLED_CLASS.neutral,
  in_progress: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  delayed: STATUS_FILLED_CLASS.warning,
  completed: STATUS_FILLED_CLASS.success,
};
const DOT: Record<WorkPlanStatus, string> = {
  not_started: "bg-muted-foreground",
  in_progress: "bg-blue-500",
  delayed: "bg-warning",
  completed: "bg-success",
};

export function WorkPlanStatusBadge({ status, locale }: { status: WorkPlanStatus; locale: Locale }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", CLASS[status])}>
      <span className={cn("size-1.5 rounded-full", DOT[status])} />
      {t(locale, `workplan.status.${status}` as DictionaryKey)}
    </span>
  );
}
