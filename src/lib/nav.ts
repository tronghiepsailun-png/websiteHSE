import {
  LayoutDashboard,
  AlertTriangle,
  Building2,
  Tags,
  Gauge,
  Users,
  IdCard,
  FileCheck2,
  ClipboardList,
  ShieldCheck,
  ShieldX,
  FileText,
  Leaf,
  ShoppingCart,
  Warehouse,
  FileSpreadsheet,
  GraduationCap,
  BookOpen,
  Library,
  ListTodo,
  Package,
  ClipboardCheck,
  History,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PERMISSIONS } from "@/server/permissions";
import type { DictionaryKey } from "@/lib/i18n/translate";

export type NavItem = { href: string; labelKey: DictionaryKey; permission?: string; icon: LucideIcon };
export type NavSection = { labelKey: DictionaryKey; items: NavItem[] };

// The main sidebar, restructured into HSE-domain sections. Placeholder items (no
// `permission`) point at modules that don't have real data/logic yet — they're
// visible to every org member and render a "Chưa có dữ liệu" empty state until a
// real module is built behind them (see src/components/module-empty-state.tsx).
export const NAV_SECTIONS: NavSection[] = [
  {
    labelKey: "nav.groupOverview",
    items: [{ href: "/", labelKey: "nav.dashboard", icon: LayoutDashboard }],
  },
  {
    labelKey: "nav.groupWorkPlan",
    items: [{ href: "/planning", labelKey: "nav.workPlan", permission: PERMISSIONS.WORKPLAN_VIEW, icon: ListTodo }],
  },
  {
    labelKey: "nav.groupIncidentMgmt",
    items: [
      { href: "/incidents", labelKey: "nav.incidents", permission: PERMISSIONS.INCIDENT_VIEW, icon: AlertTriangle },
      { href: "/capa", labelKey: "nav.capa", permission: PERMISSIONS.CAPA_VIEW, icon: ClipboardCheck },
    ],
  },
  {
    labelKey: "nav.groupEmployeeMgmt",
    items: [
      { href: "/employees", labelKey: "nav.employees", permission: PERMISSIONS.EMPLOYEE_VIEW, icon: IdCard },
      { href: "/employees/security", labelKey: "nav.employeeSecurity", permission: PERMISSIONS.SECURITY_VIEW, icon: ShieldCheck },
    ],
  },
  {
    labelKey: "nav.groupViolationMgmt",
    items: [{ href: "/violations", labelKey: "nav.violations", permission: PERMISSIONS.VIOLATION_VIEW, icon: ShieldX }],
  },
  {
    labelKey: "nav.groupDocumentMgmt",
    items: [
      { href: "/documents/hse", labelKey: "nav.documentsHse", permission: PERMISSIONS.DOCS_HSE_VIEW, icon: FileText },
      { href: "/records/pccc", labelKey: "nav.recordsPccc", permission: PERMISSIONS.RECORDS_VIEW, icon: FileCheck2 },
      { href: "/documents/environment", labelKey: "nav.documentsEnvironment", permission: PERMISSIONS.DOCS_ENVIRONMENT_VIEW, icon: Leaf },
    ],
  },
  {
    labelKey: "nav.groupProcurementMgmt",
    items: [
      { href: "/procurement", labelKey: "nav.procurement", permission: PERMISSIONS.PROCUREMENT_VIEW, icon: ShoppingCart },
      { href: "/inventory", labelKey: "nav.inventory", permission: PERMISSIONS.INVENTORY_VIEW, icon: Warehouse },
      { href: "/forms", labelKey: "nav.forms", permission: PERMISSIONS.FORMS_VIEW, icon: FileSpreadsheet },
    ],
  },
  {
    labelKey: "nav.groupTrainingMgmt",
    items: [
      { href: "/training/new-employees", labelKey: "nav.trainingNewEmployees", permission: PERMISSIONS.TRAINING_NEW_EMPLOYEES_VIEW, icon: GraduationCap },
      { href: "/training/incidents", labelKey: "nav.trainingIncidents", permission: PERMISSIONS.TRAINING_INCIDENTS_VIEW, icon: BookOpen },
      { href: "/training/materials", labelKey: "nav.trainingMaterials", permission: PERMISSIONS.TRAINING_MATERIALS_VIEW, icon: Library },
      { href: "/training/forms", labelKey: "nav.trainingForms", permission: PERMISSIONS.TRAINING_FORMS_VIEW, icon: FileSpreadsheet },
    ],
  },
];

// No longer rendered in the main sidebar — consumed by the "/settings" hub page instead
// (see src/app/(platform)/settings/page.tsx). Kept here so every admin route still has
// one canonical labelKey/icon definition, shared between the (now-hidden) old sidebar
// group and the new hub.
export const ADMIN_NAV_ITEMS: NavItem[] = [
  { href: "/admin/org-units", labelKey: "nav.orgStructure", permission: PERMISSIONS.CONFIG_MANAGE, icon: Building2 },
  { href: "/admin/categories", labelKey: "nav.incidentCategories", permission: PERMISSIONS.CONFIG_MANAGE, icon: Tags },
  { href: "/admin/severities", labelKey: "nav.incidentSeverities", permission: PERMISSIONS.CONFIG_MANAGE, icon: Gauge },
  { href: "/admin/users", labelKey: "nav.usersRoles", permission: PERMISSIONS.USER_MANAGE, icon: Users },
  { href: "/records/pccc/catalog", labelKey: "nav.recordsCatalog", permission: PERMISSIONS.RECORDS_EDIT, icon: ClipboardList },
  { href: "/admin/hse-targets", labelKey: "nav.hseTargets", permission: PERMISSIONS.CONFIG_MANAGE, icon: Gauge },
  { href: "/inventory/catalog", labelKey: "nav.inventoryCatalog", permission: PERMISSIONS.INVENTORY_EDIT, icon: Package },
  { href: "/admin/audit-log", labelKey: "nav.auditLog", permission: PERMISSIONS.USER_MANAGE, icon: History },
];

export function canSee(item: NavItem, permissionKeys: string[] | null) {
  if (!item.permission) return true;
  if (permissionKeys === null) return true; // null = platform admin / full access
  return permissionKeys.includes(item.permission);
}
