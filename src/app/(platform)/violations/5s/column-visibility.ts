import type { ToggleableColumn } from "@/lib/column-visibility";

// Kept in its own plain module (no "use client") so the server page.tsx can read the real
// values — a Server Component importing a constant straight out of a "use client" file (like
// safety-5s-table.tsx) gets back an opaque client reference instead of the actual string/array.
export const SAFETY_5S_COLUMNS_COOKIE = "violations_5s_hidden_columns";

export const SAFETY_5S_TOGGLEABLE_COLUMNS: ToggleableColumn[] = [
  { id: "employeeCode", labelKey: "violationsLienDe.table.employeeCode" },
  { id: "fullNameZh", labelKey: "violationsLienDe.table.fullNameZh" },
  { id: "orgUnitLevel1", labelKey: "violationsLienDe.table.orgUnitLevel1" },
  { id: "region", labelKey: "violationsLienDe.table.region" },
  { id: "orgUnitLevel2", labelKey: "violationsLienDe.table.orgUnitLevel2" },
  { id: "team", labelKey: "violationsLienDe.table.team" },
  { id: "shift", labelKey: "violationsLienDe.table.shift" },
  { id: "position", labelKey: "violationsLienDe.table.position" },
  { id: "note", labelKey: "violations5s.table.note" },
];

// The 6 org/identity columns that collapse into a single "auto-filled from employee" hint cell
// while a row is being added/edited — used to compute that cell's colSpan dynamically.
export const SAFETY_5S_ORG_GROUP_COLUMNS = ["orgUnitLevel1", "region", "orgUnitLevel2", "team", "shift", "position"] as const;
