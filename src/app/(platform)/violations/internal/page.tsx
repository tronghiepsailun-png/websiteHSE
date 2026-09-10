import Link from "next/link";
import { cookies } from "next/headers";
import { Download } from "lucide-react";
import { tryApiAccess } from "@/server/api-guard";
import { NoPermissionState } from "@/components/no-permission-state";
import { PERMISSIONS } from "@/server/permissions";
import { prisma } from "@/lib/prisma";
import { listSafetyOfficers, listViolationTypes, listViolations, getSubsidyReport, availableViolationMonths } from "@/server/violations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { MonthFilter } from "./month-filter";
import { ViolationTable, type ViolationRowData } from "./violation-table";
import { VIOLATION_COLUMNS_COOKIE, VIOLATION_TOGGLEABLE_COLUMNS } from "./column-visibility";
import { parseHiddenColumns } from "@/lib/column-visibility";
import { T } from "@/components/i18n/t";
import { getLocale } from "@/lib/i18n/get-locale.server";

function vnd(n: number) {
  return `${n.toLocaleString("vi-VN")} đ`;
}

function violationLabel(vt: { labelVi: string; labelZh: string | null }, locale: string) {
  return locale === "zh" ? (vt.labelZh ?? vt.labelVi) : vt.labelVi;
}

function hasPermission(permissionKeys: string[] | null, key: string) {
  return permissionKeys === null || permissionKeys.includes(key);
}

export default async function ViolationsInternalPage({ searchParams }: PageProps<"/violations/internal">) {
  const access = await tryApiAccess(PERMISSIONS.VIOLATION_VIEW);
  if ("denied" in access) return <NoPermissionState />;
  const ctx = access;
  const params = await searchParams;
  const locale = await getLocale();
  const cookieStore = await cookies();
  const hiddenColumns = parseHiddenColumns(cookieStore.get(VIOLATION_COLUMNS_COOKIE)?.value, VIOLATION_TOGGLEABLE_COLUMNS);

  const now = new Date();
  const ymRaw = typeof params.ym === "string" ? params.ym : "";
  const [yRaw, mRaw] = ymRaw.split("-");
  const year = Number(yRaw) || now.getFullYear();
  const month = Number(mRaw) || now.getMonth() + 1;

  const [officers, violationTypes, violations, subsidy, monthOptions, permissionKeys] = await Promise.all([
    listSafetyOfficers(ctx.organizationId),
    listViolationTypes(ctx.organizationId),
    listViolations(ctx.organizationId, { year, month }),
    getSubsidyReport(ctx.organizationId, { year, month }),
    availableViolationMonths(ctx.organizationId),
    ctx.isPlatformAdmin
      ? Promise.resolve(null)
      : prisma.userOrganizationRole
          .findMany({ where: { userId: ctx.userId, organizationId: ctx.organizationId }, include: { role: { include: { rolePermissions: { include: { permission: true } } } } } })
          .then((rows) => rows.flatMap((r) => r.role.rolePermissions.map((rp) => rp.permission.key))),
  ]);

  const canEdit = hasPermission(permissionKeys, PERMISSIONS.VIOLATION_EDIT);
  const canDelete = hasPermission(permissionKeys, PERMISSIONS.VIOLATION_DELETE);
  const canDownload = hasPermission(permissionKeys, PERMISSIONS.VIOLATION_DOWNLOAD);
  const canCreate = canEdit && officers.length > 0 && violationTypes.length > 0;

  const officerOptions = officers.map((o) => ({
    id: o.id,
    employeeCode: o.employee.employeeCode,
    fullName: o.employee.fullName,
    fullNameZh: o.employee.fullNameZh,
    dept1: o.employee.orgUnitLevel1,
    dept2: o.employee.orgUnitLevel2,
    region: o.employee.region,
    shift: o.employee.shift,
  }));

  const totalFineVnd = violations.reduce((sum, v) => sum + v.amountVnd, 0);

  const violationRows: ViolationRowData[] = violations.map((v) => ({
    id: v.id,
    safetyOfficerId: v.safetyOfficerId,
    employeeCode: v.safetyOfficer.employee.employeeCode,
    fullName: v.safetyOfficer.employee.fullName,
    fullNameZh: v.safetyOfficer.employee.fullNameZh,
    dept1: v.safetyOfficer.employee.orgUnitLevel1,
    dept2: v.safetyOfficer.employee.orgUnitLevel2,
    region: v.safetyOfficer.employee.region,
    shift: v.safetyOfficer.employee.shift,
    violationTypeId: v.violationTypeId,
    violationLabel: violationLabel(v.violationType, locale),
    occurredAt: v.occurredAt,
    note: v.note,
    amountVnd: v.amountVnd,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {canDownload && (
            <a
              href={`/api/violations/export?year=${year}&month=${month}`}
              className={buttonVariants({ variant: "outline" })}
            >
              <Download className="size-4" />
              <T k="violations.download.button" />
            </a>
          )}
          {canEdit && (
            <Link href="/violations/internal/catalog" className={buttonVariants({ variant: "outline" })}>
              <T k="violations.catalog.title" />
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              <T k="violations.kpi.count" />
            </p>
            <CardTitle className="text-2xl leading-none font-bold">{violations.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              <T k="violations.kpi.totalFine" />
            </p>
            <CardTitle className="text-2xl leading-none font-bold text-destructive">{vnd(totalFineVnd)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <MonthFilter year={year} month={month} options={monthOptions} />

      {canEdit && (officers.length === 0 || violationTypes.length === 0) && (
        <Card>
          <CardContent className="pt-6">
            <EmptyState
              message={<T k="violations.form.needsSetup" />}
              action={
                <Link href="/violations/internal/catalog" className={buttonVariants({ size: "sm" })}>
                  <T k="violations.catalog.title" />
                </Link>
              }
            />
          </CardContent>
        </Card>
      )}

      <h2 className="text-lg font-semibold"><T k="violations.log.title" /></h2>
      <ViolationTable
        items={violationRows}
        officers={officerOptions}
        violationTypes={violationTypes}
        year={year}
        month={month}
        canCreate={canCreate}
        canEdit={canEdit}
        canDelete={canDelete}
        hiddenColumns={[...hiddenColumns]}
      />

      <h2 className="text-lg font-semibold"><T k="violations.subsidy.title" /></h2>
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow className="h-11">
                <TableHead><T k="violations.table.stt" /></TableHead>
                <TableHead><T k="violations.table.code" /></TableHead>
                <TableHead><T k="incidents.table.employee" /></TableHead>
                <TableHead><T k="violations.table.department" /></TableHead>
                <TableHead><T k="violations.table.area" /></TableHead>
                <TableHead><T k="violations.table.shift" /></TableHead>
                <TableHead className="text-right"><T k="violations.catalog.baseSubsidy" /></TableHead>
                <TableHead className="text-right"><T k="violations.subsidy.deduction" /></TableHead>
                <TableHead className="text-right"><T k="violations.subsidy.net" /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subsidy.rows.map((r, i) => (
                <TableRow key={r.safetyOfficer.id} className="h-14">
                  <TableCell className="py-3 text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="py-3">{r.safetyOfficer.employee.employeeCode}</TableCell>
                  <TableCell className="py-3">
                    <div className="font-medium">{r.safetyOfficer.employee.fullName}</div>
                    {r.safetyOfficer.employee.fullNameZh && (
                      <div className="text-xs text-muted-foreground">{r.safetyOfficer.employee.fullNameZh}</div>
                    )}
                  </TableCell>
                  <TableCell className="py-3 text-muted-foreground">
                    {[r.safetyOfficer.employee.orgUnitLevel1, r.safetyOfficer.employee.orgUnitLevel2].filter(Boolean).join(" / ") || "—"}
                  </TableCell>
                  <TableCell className="py-3 text-muted-foreground">{r.safetyOfficer.employee.region ?? "—"}</TableCell>
                  <TableCell className="py-3 text-muted-foreground">{r.safetyOfficer.employee.shift ?? "—"}</TableCell>
                  <TableCell className="py-3 text-right whitespace-nowrap">{vnd(r.baseAmountVnd)}</TableCell>
                  <TableCell className="py-3 text-right whitespace-nowrap text-destructive">
                    {r.deductionVnd > 0 ? `-${vnd(r.deductionVnd)}` : vnd(0)}
                  </TableCell>
                  <TableCell className="py-3 text-right font-medium whitespace-nowrap">{vnd(r.netAmountVnd)}</TableCell>
                </TableRow>
              ))}
              {subsidy.rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9}>
                    <EmptyState message={<T k="violations.subsidy.empty" />} />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            {subsidy.rows.length > 0 && (
              <tfoot>
                <TableRow className="h-12 font-semibold">
                  <TableCell className="py-3" colSpan={6}><T k="violations.subsidy.total" /></TableCell>
                  <TableCell className="py-3 text-right whitespace-nowrap">{vnd(subsidy.totalBaseVnd)}</TableCell>
                  <TableCell className="py-3 text-right whitespace-nowrap text-destructive">
                    {subsidy.totalDeductionVnd > 0 ? `-${vnd(subsidy.totalDeductionVnd)}` : vnd(0)}
                  </TableCell>
                  <TableCell className="py-3 text-right whitespace-nowrap">{vnd(subsidy.totalNetVnd)}</TableCell>
                </TableRow>
              </tfoot>
            )}
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
