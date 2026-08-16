// Types/constants shared between the server-only import engine (employee-import.ts,
// which pulls in exceljs) and client components that need to render the preview —
// this file must stay free of Node-only imports so it's safe to import from "use client".
import type { DictionaryKey } from "@/lib/i18n/translate";

export type FieldKey =
  | "employeeCode"
  | "fullName"
  | "fullNameZh"
  | "gender"
  | "education"
  | "birthDate"
  | "nationalId"
  | "orgUnitLevel1"
  | "region"
  | "costCenterName"
  | "orgUnitLevel2"
  | "team"
  | "shift"
  | "position";

export const REQUIRED_FIELDS: FieldKey[] = ["employeeCode", "fullName", "orgUnitLevel1"];

/** Human-readable label (as a translation key) for each field — used in header-error and diff messages. */
export const FIELD_LABEL_KEYS: Record<FieldKey, DictionaryKey> = {
  employeeCode: "employees.field.employeeCode",
  fullName: "employees.field.fullName",
  fullNameZh: "employees.field.fullNameZh",
  gender: "employees.field.gender",
  education: "employees.field.education",
  birthDate: "employees.field.birthDate",
  nationalId: "employees.field.nationalId",
  orgUnitLevel1: "employees.field.orgUnitLevel1",
  region: "employees.field.region",
  costCenterName: "employees.field.costCenterName",
  orgUnitLevel2: "employees.field.orgUnitLevel2",
  team: "employees.field.team",
  shift: "employees.field.shift",
  position: "employees.field.position",
};

export type ParsedEmployeeFields = {
  employeeCode: string;
  fullName: string;
  fullNameZh: string | null;
  gender: "male" | "female" | null;
  education: string | null;
  birthDate: string | null; // ISO date (yyyy-mm-dd), kept as a plain string end-to-end so it survives the client round-trip
  nationalId: string | null;
  orgUnitLevel1: string;
  region: string | null;
  costCenterName: string | null;
  orgUnitLevel2: string | null;
  team: string | null;
  shift: string | null;
  position: string | null;
};

export type FieldDiff = { field: FieldKey; oldValue: string; newValue: string };

export type EmployeeRowClassification = "new" | "existing" | "updated" | "error";

export type ClassifiedEmployeeRow = {
  row: number;
  status: EmployeeRowClassification;
  employeeCode: string;
  employeeId: string | null; // set for existing/updated
  data: ParsedEmployeeFields | null; // null only when status is "error" and required fields couldn't even be read
  diffs: FieldDiff[]; // only non-empty when status is "updated"
  errors: DictionaryKey[]; // only non-empty when status is "error"
};

export type DepartedEmployee = { employeeId: string; employeeCode: string; fullName: string };

export type EmployeeImportSummary = {
  newCount: number;
  existingCount: number;
  updatedCount: number;
  errorCount: number;
  departedCount: number;
};

export type EmployeeImportPreview =
  | { ok: false; headerErrors: { column: FieldKey }[] }
  | {
      ok: true;
      totalDataRows: number;
      summary: EmployeeImportSummary;
      rows: ClassifiedEmployeeRow[];
      departedEmployees: DepartedEmployee[];
    };

export type EmployeeImportCommitResult = {
  created: number;
  updated: number;
  departed: number;
  skippedErrors: number;
};
