// Keys must match the `permissions.key` rows seeded in prisma/seed.ts.
export const PERMISSIONS = {
  ORG_VIEW: "organization.view",
  ORG_MANAGE: "organization.manage",
  USER_MANAGE: "user.manage",
  CONFIG_MANAGE: "config.manage",
  EMPLOYEE_VIEW: "employee.view",
  EMPLOYEE_MANAGE: "employee.manage",
  INCIDENT_VIEW: "incident.view",
  INCIDENT_CREATE: "incident.create",
  INCIDENT_EDIT: "incident.edit",
  INCIDENT_DELETE: "incident.delete",
  CAPA_VIEW: "capa.view",
  CAPA_CREATE: "capa.create",
  CAPA_EDIT: "capa.edit",
  CAPA_APPROVE: "capa.approve",
  CAPA_CLOSE: "capa.close",
  DOCUMENT_UPLOAD: "document.upload",
  DOCUMENT_DELETE: "document.delete",
  RECORDS_VIEW: "records.view",
  RECORDS_MANAGE: "records.manage",
  VIOLATION_VIEW: "violation.view",
  VIOLATION_MANAGE: "violation.manage",
  WORKPLAN_VIEW: "workplan.view",
  WORKPLAN_MANAGE: "workplan.manage",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
