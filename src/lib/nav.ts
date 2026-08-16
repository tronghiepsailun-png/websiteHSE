import {
  LayoutDashboard,
  AlertTriangle,
  Building2,
  Tags,
  Gauge,
  Users,
  Briefcase,
  IdCard,
  FileCheck2,
  ClipboardList,
  Star,
  Clock,
  ShieldX,
  AlertOctagon,
  FileText,
  Leaf,
  ShoppingCart,
  Warehouse,
  FileSpreadsheet,
  GraduationCap,
  BookOpen,
  Library,
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
    labelKey: "nav.groupIncidentMgmt",
    items: [{ href: "/incidents", labelKey: "nav.incidents", permission: PERMISSIONS.INCIDENT_VIEW, icon: AlertTriangle }],
  },
  {
    labelKey: "nav.groupEmployeeMgmt",
    items: [
      { href: "/employees", labelKey: "nav.employees", permission: PERMISSIONS.EMPLOYEE_VIEW, icon: IdCard },
      { href: "/employees/evaluation", labelKey: "nav.employeeEvaluation", icon: Star },
      { href: "/employees/attendance", labelKey: "nav.employeeAttendance", icon: Clock },
    ],
  },
  {
    labelKey: "nav.groupViolationMgmt",
    items: [
      { href: "/violations/5s", labelKey: "nav.violations5s", icon: AlertOctagon },
      { href: "/violations/internal", labelKey: "nav.violationsInternal", icon: ShieldX },
      { href: "/violations/external", labelKey: "nav.violationsExternal", icon: AlertTriangle },
    ],
  },
  {
    labelKey: "nav.groupDocumentMgmt",
    items: [
      { href: "/documents/hse", labelKey: "nav.documentsHse", icon: FileText },
      { href: "/records/pccc", labelKey: "nav.recordsPccc", permission: PERMISSIONS.RECORDS_VIEW, icon: FileCheck2 },
      { href: "/documents/environment", labelKey: "nav.documentsEnvironment", icon: Leaf },
    ],
  },
  {
    labelKey: "nav.groupProcurementMgmt",
    items: [
      { href: "/procurement", labelKey: "nav.procurement", icon: ShoppingCart },
      { href: "/inventory", labelKey: "nav.inventory", icon: Warehouse },
      { href: "/forms", labelKey: "nav.forms", icon: FileSpreadsheet },
    ],
  },
  {
    labelKey: "nav.groupTrainingMgmt",
    items: [
      { href: "/training/new-employees", labelKey: "nav.trainingNewEmployees", icon: GraduationCap },
      { href: "/training/incidents", labelKey: "nav.trainingIncidents", icon: BookOpen },
      { href: "/training/materials", labelKey: "nav.trainingMaterials", icon: Library },
      { href: "/training/forms", labelKey: "nav.trainingForms", icon: FileSpreadsheet },
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
  { href: "/records/pccc/catalog", labelKey: "nav.recordsCatalog", permission: PERMISSIONS.RECORDS_MANAGE, icon: ClipboardList },
];

export const PLATFORM_NAV_ITEMS: NavItem[] = [{ href: "/admin/platform/organizations", labelKey: "nav.organizations", icon: Briefcase }];

export function canSee(item: NavItem, permissionKeys: string[] | null) {
  if (!item.permission) return true;
  if (permissionKeys === null) return true; // null = platform admin / full access
  return permissionKeys.includes(item.permission);
}
