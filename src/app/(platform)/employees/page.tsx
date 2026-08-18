import Link from "next/link";
import { Users, UserCheck, UserX } from "lucide-react";
import { requireApiAccess } from "@/server/api-guard";
import { PERMISSIONS } from "@/server/permissions";
import { listEmployees, getEmployeeFilterOptions, getEmployeeStats, getEmployeeHierarchy } from "@/server/employees";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { TablePagination } from "@/components/ui/table-pagination";
import { T } from "@/components/i18n/t";
import { EmployeeFilters } from "./employee-filters";
import { EmployeeRowActions } from "./employee-row-actions";
import { ImportDialog } from "./import-dialog";
import { DepartmentChart } from "./department-chart";
import { STATUS_TILE_CLASS, STATUS_OUTLINE_CLASS } from "@/lib/status-tone";

function hasPermission(permissionKeys: string[] | null, key: string) {
  return permissionKeys === null || permissionKeys.includes(key);
}

function parseFilterParam(value: unknown): string | undefined {
  if (typeof value !== "string" || value === "" || value === "all") return undefined;
  return value;
}

export default async function EmployeesPage({ searchParams }: PageProps<"/employees">) {
  const ctx = await requireApiAccess(PERMISSIONS.EMPLOYEE_VIEW);
  const params = await searchParams;

  const search = typeof params.q === "string" && params.q !== "" ? params.q : undefined;
  const orgUnitLevel1 = parseFilterParam(params.orgUnitLevel1);
  const orgUnitLevel2 = parseFilterParam(params.orgUnitLevel2);
  const region = parseFilterParam(params.region);
  const team = parseFilterParam(params.team);
  const shift = parseFilterParam(params.shift);
  const position = parseFilterParam(params.position);
  const status = parseFilterParam(params.status);
  const page = Number(params.page) || 1;
  const viewAll = params.viewAll === "1";

  const [{ items, total, pageSize }, options, stats, hierarchy, permissionKeys] = await Promise.all([
    listEmployees(ctx.organizationId, { search, orgUnitLevel1, orgUnitLevel2, region, team, shift, position, status, page, viewAll }),
    getEmployeeFilterOptions(ctx.organizationId, { search, orgUnitLevel1, orgUnitLevel2, region, team, shift, position, status }),
    getEmployeeStats(ctx.organizationId),
    getEmployeeHierarchy(ctx.organizationId),
    ctx.isPlatformAdmin
      ? Promise.resolve(null)
      : prisma.userOrganizationRole
          .findMany({ where: { userId: ctx.userId, organizationId: ctx.organizationId }, include: { role: { include: { rolePermissions: { include: { permission: true } } } } } })
          .then((rows) => rows.flatMap((r) => r.role.rolePermissions.map((rp) => rp.permission.key))),
  ]);

  const canManage = hasPermission(permissionKeys, PERMISSIONS.EMPLOYEE_MANAGE);

  // "Xem chi tiết" defaults to whichever Bộ phận cấp 1 contains the department currently
  // selected on the chart (via orgUnitLevel2), so it opens already scoped to what's on screen.
  const defaultOrgUnitLevel1 = orgUnitLevel2
    ? hierarchy.find((l1) => l1.level2.some((l2) => l2.orgUnitLevel2 === orgUnitLevel2))?.orgUnitLevel1 ?? undefined
    : undefined;

  const buildHref = (overrides: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (typeof value !== "string") continue;
      next.set(key, value);
    }
    for (const [key, value] of Object.entries(overrides)) {
      if (value === undefined) next.delete(key);
      else next.set(key, value);
    }
    return `/employees${next.toString() ? `?${next.toString()}` : ""}`;
  };

  const clearOrgUnitLevel2Href = buildHref({ orgUnitLevel2: undefined, page: undefined });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">
            <T k="employees.moduleName" />
          </h1>
          <p className="text-sm text-muted-foreground">
            <T k="employees.pageSubtitle" />
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a href="/api/employees/export" className={buttonVariants({ variant: "outline" })}>
            <T k="employees.download.button" />
          </a>
          {canManage && <ImportDialog />}
          {canManage && (
            <Link href="/employees/new" className={buttonVariants()}>
              <T k="employees.addButton" />
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <Users className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                <T k="employees.kpi.total" />
              </p>
              <p className="text-2xl leading-none font-bold">{stats.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card className={STATUS_TILE_CLASS.success.border}>
          <CardContent className="flex items-center gap-3 p-3">
            <div className={`flex size-8 shrink-0 items-center justify-center rounded-md ${STATUS_TILE_CLASS.success.iconBg} ${STATUS_TILE_CLASS.success.iconFg}`}>
              <UserCheck className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                <T k="employees.kpi.active" />
              </p>
              <p className="text-2xl leading-none font-bold">{stats.active}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <UserX className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                <T k="employees.kpi.resigned" />
              </p>
              <p className="text-2xl leading-none font-bold">{stats.resigned}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <DepartmentChart
        data={stats.byDepartment}
        total={stats.total}
        selected={orgUnitLevel2}
        hierarchy={hierarchy}
        defaultOrgUnitLevel1={defaultOrgUnitLevel1}
      />

      <EmployeeFilters
        search={search}
        orgUnitLevel1={orgUnitLevel1}
        orgUnitLevel2={orgUnitLevel2}
        region={region}
        team={team}
        shift={shift}
        position={position}
        status={status}
        options={options}
      />

      {orgUnitLevel2 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">
              <T k="employees.chart.filteringBy" />
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-primary">
              {orgUnitLevel2}
            </span>
            <span className="text-muted-foreground">
              <T k="employees.table.paginationSummary" vars={{ total }} />
            </span>
          </div>
          <Link href={clearOrgUnitLevel2Href} className={buttonVariants({ variant: "outline", size: "sm" })}>
            <T k="employees.chart.clearFilter" />
          </Link>
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow className="h-11">
                <TableHead><T k="employees.table.code" /></TableHead>
                <TableHead><T k="employees.table.nameVi" /></TableHead>
                <TableHead><T k="employees.table.nameZh" /></TableHead>
                <TableHead><T k="employees.field.orgUnitLevel1" /></TableHead>
                <TableHead><T k="employees.field.orgUnitLevel2" /></TableHead>
                <TableHead><T k="employees.field.region" /></TableHead>
                <TableHead><T k="employees.field.shift" /></TableHead>
                <TableHead><T k="employees.field.position" /></TableHead>
                <TableHead><T k="common.status" /></TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((employee) => (
                <TableRow key={employee.id} className="h-14">
                  <TableCell className="py-3 font-medium">{employee.employeeCode}</TableCell>
                  <TableCell className="py-3">{employee.fullName}</TableCell>
                  <TableCell className="py-3">{employee.fullNameZh ?? "—"}</TableCell>
                  <TableCell className="py-3">{employee.orgUnitLevel1 ?? "—"}</TableCell>
                  <TableCell className="py-3">{employee.orgUnitLevel2 ?? "—"}</TableCell>
                  <TableCell className="py-3">{employee.region ?? "—"}</TableCell>
                  <TableCell className="py-3">{employee.shift ?? "—"}</TableCell>
                  <TableCell className="py-3">{employee.position ?? "—"}</TableCell>
                  <TableCell className="py-3">
                    <Badge
                      variant={employee.status === "active" ? "outline" : "secondary"}
                      className={employee.status === "active" ? STATUS_OUTLINE_CLASS.success : ""}
                    >
                      <T k={employee.status === "active" ? "employees.status.active" : "employees.status.resigned"} />
                    </Badge>
                  </TableCell>
                  <TableCell className="py-3 text-right">
                    <EmployeeRowActions employee={employee} canManage={canManage} />
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10}>
                    <EmptyState message={<T k="employees.table.noResults" />} />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <TablePagination
            total={total}
            page={page}
            pageSize={pageSize}
            viewAll={viewAll}
            unitLabelKey="employees.unitLabel"
            basePath="/employees"
            searchParams={params}
          />
        </CardContent>
      </Card>
    </div>
  );
}
