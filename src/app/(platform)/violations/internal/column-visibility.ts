import type { ToggleableColumn } from "@/lib/column-visibility";

// Plain module (no "use client") — a Server Component importing a constant straight out of a
// "use client" file (like violation-table.tsx) gets back an opaque client reference instead of
// the actual string/array (see the 5S module's column-visibility.ts for the full story).
export const VIOLATION_COLUMNS_COOKIE = "violations_internal_hidden_columns";

export const VIOLATION_TOGGLEABLE_COLUMNS: ToggleableColumn[] = [
  { id: "department", labelKey: "violations.table.department" },
  { id: "area", labelKey: "violations.table.area" },
  { id: "shift", labelKey: "violations.table.shift" },
  { id: "note", labelKey: "violations.form.note" },
];
