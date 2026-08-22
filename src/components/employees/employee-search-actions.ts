"use server";

import { requireOrgPermission } from "@/server/api-guard";
import { PERMISSIONS } from "@/server/permissions";
import { searchEmployeesLite, type EmployeeLite } from "@/server/employees";

export async function searchEmployeesAction(query: string): Promise<EmployeeLite[]> {
  const ctx = await requireOrgPermission(PERMISSIONS.EMPLOYEE_VIEW);
  return searchEmployeesLite(ctx.organizationId, query);
}
