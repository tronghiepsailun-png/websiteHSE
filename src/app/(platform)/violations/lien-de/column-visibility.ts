import type { ToggleableColumn } from "@/lib/column-visibility";

// Plain module (no "use client") — a Server Component importing a constant straight out of a
// "use client" file (like deduction-table.tsx) gets back an opaque client reference instead of
// the actual string/array (see the 5S module's column-visibility.ts for the full story).
export const DEDUCTION_COLUMNS_COOKIE = "violations_lien_de_hidden_columns";

export const DEDUCTION_TOGGLEABLE_COLUMNS: ToggleableColumn[] = [
  { id: "employeeCode", labelKey: "violationsLienDe.table.employeeCode" },
  { id: "fullNameZh", labelKey: "violationsLienDe.table.fullNameZh" },
  { id: "orgUnitLevel1", labelKey: "violationsLienDe.table.orgUnitLevel1" },
  { id: "region", labelKey: "violationsLienDe.table.region" },
  { id: "orgUnitLevel2", labelKey: "violationsLienDe.table.orgUnitLevel2" },
  { id: "team", labelKey: "violationsLienDe.table.team" },
  { id: "shift", labelKey: "violationsLienDe.table.shift" },
  { id: "position", labelKey: "violationsLienDe.table.position" },
  { id: "reporterName", labelKey: "violationsLienDe.table.reporterName" },
];

// The 6 org/identity columns that collapse into a single "auto-filled from employee" hint cell
// while a row is being added/edited — used to compute that cell's colSpan dynamically.
export const DEDUCTION_ORG_GROUP_COLUMNS = ["orgUnitLevel1", "region", "orgUnitLevel2", "team", "shift", "position"] as const;
