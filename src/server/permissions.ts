// Keys must match the `permissions.key` rows seeded in prisma/seed.ts.
export const PERMISSIONS = {
  ORG_VIEW: "organization.view",
  ORG_MANAGE: "organization.manage",
  USER_MANAGE: "user.manage",
  CONFIG_MANAGE: "config.manage",
  EMPLOYEE_VIEW: "employee.view",
  EMPLOYEE_EDIT: "employee.edit",
  EMPLOYEE_DOWNLOAD: "employee.download",
  EMPLOYEE_MANAGE: "employee.manage", // legacy alias, kept for old role rows — new code checks EMPLOYEE_EDIT instead
  SECURITY_VIEW: "security.view",
  SECURITY_EDIT: "security.edit",
  INCIDENT_VIEW: "incident.view",
  INCIDENT_CREATE: "incident.create",
  INCIDENT_EDIT: "incident.edit",
  INCIDENT_DELETE: "incident.delete",
  INCIDENT_DOWNLOAD: "incident.download",
  CAPA_VIEW: "capa.view",
  CAPA_CREATE: "capa.create",
  CAPA_EDIT: "capa.edit",
  CAPA_APPROVE: "capa.approve",
  CAPA_CLOSE: "capa.close",
  CAPA_DELETE: "capa.delete",
  DOCUMENT_UPLOAD: "document.upload",
  DOCUMENT_DELETE: "document.delete",
  RECORDS_VIEW: "records.view",
  RECORDS_EDIT: "records.edit",
  RECORDS_MANAGE: "records.manage", // legacy alias, kept for old role rows — new code checks RECORDS_EDIT instead
  VIOLATION_VIEW: "violation.view",
  VIOLATION_EDIT: "violation.edit",
  VIOLATION_DELETE: "violation.delete",
  VIOLATION_DOWNLOAD: "violation.download",
  VIOLATION_MANAGE: "violation.manage", // legacy alias, kept for old role rows — new code checks VIOLATION_EDIT/DELETE instead
  WORKPLAN_VIEW: "workplan.view",
  WORKPLAN_EDIT: "workplan.edit",
  WORKPLAN_DELETE: "workplan.delete",
  WORKPLAN_MANAGE: "workplan.manage", // legacy alias, kept for old role rows — new code checks WORKPLAN_EDIT/DELETE instead
  INVENTORY_VIEW: "inventory.view",
  INVENTORY_EDIT: "inventory.edit",
  INVENTORY_DELETE: "inventory.delete",
  INVENTORY_MANAGE: "inventory.manage", // legacy alias, kept for old role rows — new code checks INVENTORY_EDIT/DELETE instead
  // The following are placeholder modules (no real data/CRUD yet, just a "Chưa có dữ liệu"
  // empty state) — view-only, no edit/delete/upload/download permission exists for them
  // because there's nothing to mutate yet. Add the edit/etc. keys when real logic lands.
  DOCS_HSE_VIEW: "docs_hse.view",
  DOCS_ENVIRONMENT_VIEW: "docs_environment.view",
  PROCUREMENT_VIEW: "procurement.view",
  FORMS_VIEW: "forms.view",
  TRAINING_NEW_EMPLOYEES_VIEW: "training_new_employees.view",
  TRAINING_INCIDENTS_VIEW: "training_incidents.view",
  TRAINING_MATERIALS_VIEW: "training_materials.view",
  TRAINING_FORMS_VIEW: "training_forms.view",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// Granted to every sub-account automatically — just lets them see basic org info, not a
// module a permission-matrix row makes sense for.
export const ALWAYS_GRANTED_PERMISSIONS: PermissionKey[] = [PERMISSIONS.ORG_VIEW];

/** One row of the per-module permission matrix shown when creating/editing a sub-account.
 *  Each column is a real, independently-enforced permission (or an array of them, for a
 *  column that maps to several equivalent underlying actions) — `null` means that action
 *  genuinely doesn't exist for this module (e.g. CAPA items are never hard-deleted, so
 *  `delete` is null and the cell renders blank instead of a checkbox that would do nothing). */
export type PermissionModule = {
  key: string;
  labelKey: string; // DictionaryKey, kept as string here to avoid a circular import with i18n
  view: PermissionKey | null;
  edit: PermissionKey[] | null;
  delete: PermissionKey[] | null;
  upload: PermissionKey[] | null;
  download: PermissionKey[] | null;
};

export const PERMISSION_MODULES: PermissionModule[] = [
  {
    key: "incident",
    labelKey: "nav.incidents",
    view: PERMISSIONS.INCIDENT_VIEW,
    edit: [PERMISSIONS.INCIDENT_CREATE, PERMISSIONS.INCIDENT_EDIT],
    delete: [PERMISSIONS.INCIDENT_DELETE, PERMISSIONS.DOCUMENT_DELETE],
    upload: [PERMISSIONS.DOCUMENT_UPLOAD],
    download: [PERMISSIONS.INCIDENT_DOWNLOAD],
  },
  {
    key: "capa",
    labelKey: "nav.capa",
    view: PERMISSIONS.CAPA_VIEW,
    edit: [PERMISSIONS.CAPA_CREATE, PERMISSIONS.CAPA_EDIT, PERMISSIONS.CAPA_APPROVE, PERMISSIONS.CAPA_CLOSE],
    // DOCUMENT_DELETE/DOCUMENT_UPLOAD are never checked by any CAPA code path — CAPA's own
    // before/after photo attach lives inside the same CAPA_CREATE/CAPA_EDIT action, not a
    // separate document permission. Bundling them here used to also (silently) grant them for
    // Incident, since that module's own Xóa/Tải lên checkboxes check those exact same keys.
    delete: [PERMISSIONS.CAPA_DELETE],
    upload: null,
    download: null, // no export/download route exists for CAPA
  },
  {
    key: "employee",
    labelKey: "nav.employees",
    view: PERMISSIONS.EMPLOYEE_VIEW,
    edit: [PERMISSIONS.EMPLOYEE_EDIT],
    delete: null, // employees are deactivated, never hard-deleted
    upload: null,
    download: [PERMISSIONS.EMPLOYEE_DOWNLOAD],
  },
  {
    key: "security",
    labelKey: "nav.employeeSecurity",
    view: PERMISSIONS.SECURITY_VIEW,
    edit: [PERMISSIONS.SECURITY_EDIT],
    delete: null,
    upload: null,
    download: null,
  },
  {
    key: "violation",
    labelKey: "nav.groupViolationMgmt",
    view: PERMISSIONS.VIOLATION_VIEW,
    edit: [PERMISSIONS.VIOLATION_EDIT],
    delete: [PERMISSIONS.VIOLATION_DELETE],
    upload: null,
    download: [PERMISSIONS.VIOLATION_DOWNLOAD],
  },
  {
    key: "records",
    labelKey: "nav.recordsPccc",
    view: PERMISSIONS.RECORDS_VIEW,
    edit: [PERMISSIONS.RECORDS_EDIT],
    delete: null, // records are superseded by a new version, never hard-deleted
    upload: null, // uploading a record file is part of the same "edit" action, not separate
    download: null, // downloading an attached file only ever requires RECORDS_VIEW
  },
  {
    key: "workplan",
    labelKey: "nav.workPlan",
    view: PERMISSIONS.WORKPLAN_VIEW,
    edit: [PERMISSIONS.WORKPLAN_EDIT],
    delete: [PERMISSIONS.WORKPLAN_DELETE],
    upload: null,
    download: null,
  },
  {
    key: "inventory",
    labelKey: "nav.inventory",
    view: PERMISSIONS.INVENTORY_VIEW,
    edit: [PERMISSIONS.INVENTORY_EDIT],
    delete: [PERMISSIONS.INVENTORY_DELETE],
    upload: null,
    download: null,
  },
  {
    key: "docs_hse",
    labelKey: "nav.documentsHse",
    view: PERMISSIONS.DOCS_HSE_VIEW,
    edit: null,
    delete: null,
    upload: null,
    download: null,
  },
  {
    key: "docs_environment",
    labelKey: "nav.documentsEnvironment",
    view: PERMISSIONS.DOCS_ENVIRONMENT_VIEW,
    edit: null,
    delete: null,
    upload: null,
    download: null,
  },
  {
    key: "procurement",
    labelKey: "nav.procurement",
    view: PERMISSIONS.PROCUREMENT_VIEW,
    edit: null,
    delete: null,
    upload: null,
    download: null,
  },
  {
    key: "forms",
    labelKey: "nav.forms",
    view: PERMISSIONS.FORMS_VIEW,
    edit: null,
    delete: null,
    upload: null,
    download: null,
  },
  {
    key: "training_new_employees",
    labelKey: "nav.trainingNewEmployees",
    view: PERMISSIONS.TRAINING_NEW_EMPLOYEES_VIEW,
    edit: null,
    delete: null,
    upload: null,
    download: null,
  },
  {
    key: "training_incidents",
    labelKey: "nav.trainingIncidents",
    view: PERMISSIONS.TRAINING_INCIDENTS_VIEW,
    edit: null,
    delete: null,
    upload: null,
    download: null,
  },
  {
    key: "training_materials",
    labelKey: "nav.trainingMaterials",
    view: PERMISSIONS.TRAINING_MATERIALS_VIEW,
    edit: null,
    delete: null,
    upload: null,
    download: null,
  },
  {
    key: "training_forms",
    labelKey: "nav.trainingForms",
    view: PERMISSIONS.TRAINING_FORMS_VIEW,
    edit: null,
    delete: null,
    upload: null,
    download: null,
  },
  {
    key: "config",
    labelKey: "admin.users.configModule",
    view: null,
    edit: [PERMISSIONS.CONFIG_MANAGE],
    delete: null,
    upload: null,
    download: null,
  },
  {
    key: "users",
    labelKey: "admin.users.usersModule",
    view: null,
    edit: [PERMISSIONS.USER_MANAGE, PERMISSIONS.ORG_MANAGE],
    delete: null,
    upload: null,
    download: null,
  },
];
