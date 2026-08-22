import { cn } from "@/lib/utils";

/** Colored purely by how far along the work is (not by status) — a quick visual read of
 *  "healthy vs. behind" independent of whatever label is in the status column next to it. */
function barColorClass(percent: number) {
  if (percent >= 60) return "bg-success";
  if (percent > 0) return "bg-warning";
  return "bg-muted-foreground/30";
}

export function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", barColorClass(percent))} style={{ width: `${percent}%` }} />
      </div>
      <span className="w-9 text-right text-xs text-muted-foreground tabular-nums">{percent}%</span>
    </div>
  );
}
