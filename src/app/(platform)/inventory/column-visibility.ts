import type { ToggleableColumn } from "@/lib/column-visibility";

export const ISSUANCE_COLUMNS_COOKIE = "inventory_issuance_hidden_columns";

export const ISSUANCE_TOGGLEABLE_COLUMNS: ToggleableColumn[] = [
  { id: "department", labelKey: "inventory.issuance.table.department" },
  { id: "note", labelKey: "inventory.issuance.table.note" },
  { id: "recordedBy", labelKey: "inventory.issuance.table.recordedBy" },
  { id: "photos", labelKey: "inventory.issuance.table.photos" },
];

export const STOCKIN_COLUMNS_COOKIE = "inventory_stockin_hidden_columns";

export const STOCKIN_TOGGLEABLE_COLUMNS: ToggleableColumn[] = [
  { id: "note", labelKey: "inventory.issuance.table.note" },
  { id: "recordedBy", labelKey: "inventory.issuance.table.recordedBy" },
  { id: "photos", labelKey: "inventory.issuance.table.photos" },
];
