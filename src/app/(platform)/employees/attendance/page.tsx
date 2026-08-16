import { Clock } from "lucide-react";
import { requireApiAccess } from "@/server/api-guard";
import { ModuleEmptyState } from "@/components/module-empty-state";

export default async function EmployeeAttendancePage() {
  await requireApiAccess(null);
  return <ModuleEmptyState icon={Clock} titleKey="nav.employeeAttendance" messageKey="modules.attendance.empty" />;
}
