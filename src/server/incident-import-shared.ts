// Types/constants shared between the server-only import engine (incident-import.ts,
// which pulls in exceljs) and client components that need to render results —
// this file must stay free of Node-only imports so it's safe to import from "use client".
import type { DictionaryKey } from "@/lib/i18n/translate";

export type FieldKey =
  | "incidentNumber"
  | "occurredAt"
  | "department"
  | "severityCode"
  | "description"
  | "correctiveAction"
  | "responsiblePersonName"
  | "injuredPersonName"
  | "locationEquipment"
  | "costRmb"
  | "costVnd"
  | "pointsDeducted"
  | "injuredBodyPart"
  | "categoryName"
  | "notes";

export const REQUIRED_FIELDS: FieldKey[] = ["incidentNumber", "occurredAt", "severityCode", "description", "categoryName"];

/** Human-readable label (as a translation key) for each field — used in header-error messages. */
export const FIELD_LABEL_KEYS: Record<FieldKey, DictionaryKey> = {
  incidentNumber: "incidents.table.number",
  occurredAt: "incidents.table.occurred",
  department: "incidents.table.department",
  severityCode: "incidents.table.severity",
  description: "incidents.detail.description",
  correctiveAction: "incidents.new.fields.correctiveAction",
  responsiblePersonName: "incidents.detail.responsiblePerson",
  injuredPersonName: "incidents.table.employee",
  locationEquipment: "incidents.table.location",
  costRmb: "incidents.detail.costRmb",
  costVnd: "incidents.detail.costVnd",
  pointsDeducted: "incidents.detail.pointsDeducted",
  injuredBodyPart: "incidents.detail.injuredBodyPart",
  categoryName: "incidents.table.category",
  notes: "incidents.new.fields.notes",
};
