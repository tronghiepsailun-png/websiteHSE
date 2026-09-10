import { requireApiAccess } from "@/server/api-guard";
import { PERMISSIONS } from "@/server/permissions";
import { getEmployeeById } from "@/server/employees";
import { T } from "@/components/i18n/t";
import { EmployeeForm } from "../../employee-form";
import { updateEmployeeAction } from "./actions";

export default async function EditEmployeePage({ params }: PageProps<"/employees/[id]/edit">) {
  const ctx = await requireApiAccess(PERMISSIONS.EMPLOYEE_EDIT);
  const { id } = await params;
  const employee = await getEmployeeById(ctx.organizationId, id);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
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
    </div>
  );
}
