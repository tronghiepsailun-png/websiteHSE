import Link from "next/link";
import { requireApiAccess } from "@/server/api-guard";
import { PERMISSIONS } from "@/server/permissions";
import { T } from "@/components/i18n/t";
import { EmployeeForm } from "../employee-form";
import { createEmployeeAction } from "./actions";

export default async function NewEmployeePage() {
  await requireApiAccess(PERMISSIONS.EMPLOYEE_EDIT);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Link href="/employees" className="text-sm text-muted-foreground hover:underline">
          ← <T k="nav.employees" />
        </Link>
        <h1 className="text-xl font-semibold">
          <T k="employees.addButton" />
        </h1>
        <p className="hidden text-sm text-muted-foreground md:block">
          <T k="employees.pageSubtitle" />
        </p>
      </div>
      <EmployeeForm action={createEmployeeAction} mode="create" submitLabelKey="employees.addButton" />
    </div>
  );
}
