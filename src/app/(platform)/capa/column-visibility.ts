import type { ToggleableColumn } from "@/lib/column-visibility";

// Deliberately NOT inside capa-table.tsx: that file is "use client", and a Server Component
// importing a plain constant from a "use client" module gets back an opaque client reference,
// not the real value — cookieStore.get(CAPA_COLUMNS_COOKIE) silently saw `undefined` for the
// cookie name until these were split out into their own plain (server-safe) module.
export const CAPA_COLUMNS_COOKIE = "capa_hidden_columns";

export const CAPA_TOGGLEABLE_COLUMNS: ToggleableColumn[] = [
  { id: "area", labelKey: "capa.table.area" },
  { id: "improvementRequirement", labelKey: "capa.table.improvementRequirement" },
  { id: "discoveredDate", labelKey: "capa.table.discoveredDate" },
  { id: "classification", labelKey: "capa.table.classification" },
  { id: "responsibleDept", labelKey: "capa.form.responsible" },
  { id: "photoBefore", labelKey: "capa.table.photoBefore" },
  { id: "photoAfter", labelKey: "capa.table.photoAfter" },
  { id: "confirmedDate", labelKey: "capa.table.confirmedDate" },
  { id: "daysUnresolved", labelKey: "capa.table.daysUnresolved" },
];
