import Link from "next/link";
import { requireApiAccess } from "@/server/api-guard";
import { PERMISSIONS } from "@/server/permissions";
import { getEmployeeById } from "@/server/employees";
import { T } from "@/components/i18n/t";
import { EmployeeForm } from "../../employee-form";
import { updateEmployeeAction } from "./actions";
import { RecordTimeline } from "@/components/ui/record-timeline";
import { listAuditLogForRecord } from "@/server/audit";
import { getLocale } from "@/lib/i18n/get-locale.server";
import { t } from "@/lib/i18n/translate";

export default async function EditEmployeePage({ params }: PageProps<"/employees/[id]/edit">) {
  const ctx = await requireApiAccess(PERMISSIONS.EMPLOYEE_EDIT);
  const { id } = await params;
  const employee = await getEmployeeById(ctx.organizationId, id);
  const locale = await getLocale();
  const auditEntries = await listAuditLogForRecord(ctx.organizationId, "employee", employee.id);
  const auditFieldLabels: Record<string, string> = {
    employeeCode: t(locale, "employees.field.employeeCode"),
    fullName: t(locale, "employees.field.fullName"),
    fullNameZh: t(locale, "employees.field.fullNameZh"),
    gender: t(locale, "employees.field.gender"),
    education: t(locale, "employees.field.education"),
    birthDate: t(locale, "employees.field.birthDate"),
    nationalId: t(locale, "employees.field.nationalId"),
    orgUnitLevel1: t(locale, "employees.field.orgUnitLevel1"),
    orgUnitLevel2: t(locale, "employees.field.orgUnitLevel2"),
    region: t(locale, "employees.field.region"),
    costCenterName: t(locale, "employees.field.costCenterName"),
    team: t(locale, "employees.field.team"),
    shift: t(locale, "employees.field.shift"),
    position: t(locale, "employees.field.position"),
    status: t(locale, "common.status"),
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Link href="/employees" className="text-sm text-muted-foreground hover:underline">
          ← <T k="nav.employees" />
        </Link>
        <h1 className="text-xl font-semibold">
          {employee.fullName} <span className="text-muted-foreground">({employee.employeeCode})</span>
        </h1>
        <p className="text-sm text-muted-foreground">
          <T k="common.edit" />
        </p>
      </div>
      <EmployeeForm
        action={updateEmployeeAction}
        mode="edit"
        employeeId={employee.id}
        submitLabelKey="common.save"
        initialValues={{
          employeeCode: employee.employeeCode,
          fullName: employee.fullName,
          fullNameZh: employee.fullNameZh ?? undefined,
          gender: employee.gender ?? undefined,
          education: employee.education ?? undefined,
          birthDate: employee.birthDate ? employee.birthDate.toISOString().slice(0, 10) : undefined,
          nationalId: employee.nationalId ?? undefined,
          orgUnitLevel1: employee.orgUnitLevel1 ?? undefined,
          orgUnitLevel2: employee.orgUnitLevel2 ?? undefined,
          region: employee.region ?? undefined,
          costCenterName: employee.costCenterName ?? undefined,
          team: employee.team ?? undefined,
          shift: employee.shift ?? undefined,
          position: employee.position ?? undefined,
          status: employee.status,
        }}
      />

      <div className="mt-6">
        <RecordTimeline entries={auditEntries} locale={locale} fieldLabels={auditFieldLabels} />
      </div>
    </div>
  );
}
