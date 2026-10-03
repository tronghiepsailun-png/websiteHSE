import type { ToggleableColumn } from "@/lib/column-visibility";

// Plain module (no "use client") so the server page can read the real values — same reason as
// violations/5s/column-visibility.ts.
export const SLEEP_COLUMNS_COOKIE = "violations_sleep_hidden_columns";

export type SleepColumnId =
  | "time"
  | "location"
  | "factory"
  | "department"
  | "position"
  | "note"
  | "liableCode"
  | "liableName"
  | "liableFine"
  | "guard"
  | "reward"
  | "remark";

export const SLEEP_TOGGLEABLE_COLUMNS: ToggleableColumn<SleepColumnId>[] = [
  { id: "time", labelKey: "sleep.col.time" },
  { id: "location", labelKey: "sleep.col.location" },
  { id: "factory", labelKey: "sleep.col.factory" },
  { id: "department", labelKey: "sleep.col.department" },
  { id: "position", labelKey: "sleep.col.position" },
  { id: "note", labelKey: "sleep.col.note" },
  { id: "liableCode", labelKey: "sleep.col.liableCode" },
  { id: "liableName", labelKey: "sleep.col.liableName" },
  { id: "liableFine", labelKey: "sleep.col.liableFine" },
  { id: "guard", labelKey: "sleep.col.guard" },
  { id: "reward", labelKey: "sleep.col.reward" },
  { id: "remark", labelKey: "sleep.col.remark" },
];
