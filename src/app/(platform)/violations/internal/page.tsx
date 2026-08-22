import Link from "next/link";
import { ShieldX } from "lucide-react";
import { requireApiAccess } from "@/server/api-guard";
import { PERMISSIONS } from "@/server/permissions";
import { prisma } from "@/lib/prisma";
import { listSafetyOfficers, listViolationTypes, listViolations, getSubsidyReport, availableViolationMonths } from "@/server/violations";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { NewViolationForm } from "./new-violation-form";
import { MonthFilter } from "./month-filter";
import { DeleteViolationButton } from "./delete-violation-button";
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
  const ctx = await requireApiAccess(PERMISSIONS.VIOLATION_VIEW);
  const params = await searchParams;
  const locale = await getLocale();

  const now = new Date();
  const ymRaw = typeof params.ym === "string" ? params.ym : "";
  const [yRaw, mRaw] = ymRaw.split("-");
  const year = Number(yRaw) || now.getFullYear();
  const month = Number(mRaw) || now.getMonth() + 1;

  const [officers, violationTypes, violations, subsidy, permissionKeys] = await Promise.all([
    listSafetyOfficers(ctx.organizationId),
    listViolationTypes(ctx.organizationId),
    listViolations(ctx.organizationId, { year, month }),
    getSubsidyReport(ctx.organizationId, { year, month }),
    ctx.isPlatformAdmin
      ? Promise.resolve(null)
      : prisma.userOrganizationRole
          .findMany({ where: { userId: ctx.userId, organizationId: ctx.organizationId }, include: { role: { include: { rolePermissions: { include: { permission: true } } } } } })
          .then((rows) => rows.flatMap((r) => r.role.rolePermissions.map((rp) => rp.permission.key))),
  ]);

  const canManage = hasPermission(permissionKeys, PERMISSIONS.VIOLATION_MANAGE);

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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold"><T k="violations.moduleName" /></h1>
          <p className="text-sm text-muted-foreground"><T k="violations.pageSubtitle" /></p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`/api/violations/export?year=${year}&month=${month}`}
            className={buttonVariants({ variant: "outline" })}
          >
            <T k="violations.download.button" />
          </a>
          {canManage && (
            <Link href="/violations/internal/catalog" className={buttonVariants({ variant: "outline" })}>
              <T k="violations.catalog.title" />
            </Link>
          )}
        </div>
      </div>

      <MonthFilter year={year} month={month} options={availableViolationMonths()} />

      {canManage && (
        <Card>
          <CardContent className="pt-6">
            {officers.length === 0 || violationTypes.length === 0 ? (
              <EmptyState
                icon={ShieldX}
                message={<T k="violations.form.needsSetup" />}
                action={
                  <Link href="/violations/internal/catalog" className={buttonVariants({ size: "sm" })}>
                    <T k="violations.catalog.title" />
                  </Link>
                }
              />
            ) : (
              <NewViolationForm officers={officerOptions} violationTypes={violationTypes} />
            )}
          </CardContent>
        </Card>
      )}

      <h2 className="text-lg font-semibold"><T k="violations.log.title" /></h2>
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow className="h-11">
                <TableHead><T k="violations.table.date" /></TableHead>
                <TableHead><T k="violations.table.code" /></TableHead>
                <TableHead><T k="incidents.table.employee" /></TableHead>
                <TableHead><T k="violations.table.department" /></TableHead>
                <TableHead><T k="violations.form.violationType" /></TableHead>
                <TableHead className="text-right"><T k="violations.table.amount" /></TableHead>
                {canManage && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {violations.map((v) => (
                <TableRow key={v.id} className="h-14">
                  <TableCell className="py-3 whitespace-nowrap">{v.occurredAt.toLocaleDateString("vi-VN")}</TableCell>
                  <TableCell className="py-3">{v.safetyOfficer.employee.employeeCode}</TableCell>
                  <TableCell className="py-3">
                    <div className="font-medium">{v.safetyOfficer.employee.fullName}</div>
                    {v.safetyOfficer.employee.fullNameZh && (
                      <div className="text-xs text-muted-foreground">{v.safetyOfficer.employee.fullNameZh}</div>
                    )}
                  </TableCell>
                  <TableCell className="py-3 text-muted-foreground">
                    {[v.safetyOfficer.employee.orgUnitLevel1, v.safetyOfficer.employee.orgUnitLevel2].filter(Boolean).join(" / ") || "—"}
                  </TableCell>
                  <TableCell className="py-3">{violationLabel(v.violationType, locale)}</TableCell>
                  <TableCell className="py-3 text-right whitespace-nowrap">{vnd(v.amountVnd)}</TableCell>
                  {canManage && (
                    <TableCell className="py-3 text-right">
                      <DeleteViolationButton violationId={v.id} />
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {violations.length === 0 && (
                <TableRow>
                  <TableCell colSpan={canManage ? 7 : 6}>
                    <EmptyState message={<T k="violations.log.empty" />} />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
