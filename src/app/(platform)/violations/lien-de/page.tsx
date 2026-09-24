import { cookies } from "next/headers";
import { Download } from "lucide-react";
import { tryApiAccess } from "@/server/api-guard";
import { NoPermissionState } from "@/components/no-permission-state";
import { PERMISSIONS } from "@/server/permissions";
import { prisma } from "@/lib/prisma";
import { listWorkInjuryDeductions, getWorkInjuryDeductionSummary, availableWorkInjuryDeductionMonths } from "@/server/work-injury-deductions";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { DeductionFilters } from "./filters";
import { DeductionTable } from "./deduction-table";
import { DEDUCTION_COLUMNS_COOKIE, DEDUCTION_TOGGLEABLE_COLUMNS } from "./column-visibility";
import { parseHiddenColumns } from "@/lib/column-visibility";
import { T } from "@/components/i18n/t";

function hasPermission(permissionKeys: string[] | null, key: string) {
  return permissionKeys === null || permissionKeys.includes(key);
}

function vnd(n: number) {
  return `${n.toLocaleString("vi-VN")} đ`;
}

export default async function ViolationsLienDePage({ searchParams }: PageProps<"/violations/lien-de">) {
  const access = await tryApiAccess(PERMISSIONS.VIOLATION_VIEW);
  if ("denied" in access) return <NoPermissionState />;
  const ctx = access;
  const params = await searchParams;
  const cookieStore = await cookies();
  const hiddenColumns = parseHiddenColumns(cookieStore.get(DEDUCTION_COLUMNS_COOKIE)?.value, DEDUCTION_TOGGLEABLE_COLUMNS);

  const now = new Date();
  const ymRaw = typeof params.ym === "string" ? params.ym : "";
  const [yRaw, mRaw] = ymRaw.split("-");
  const year = Number(yRaw) || now.getFullYear();
  const month = Number(mRaw) || now.getMonth() + 1;
  const search = typeof params.q === "string" && params.q !== "" ? params.q : undefined;

  const [items, summary, monthOptions, permissionKeys] = await Promise.all([
    listWorkInjuryDeductions(ctx.organizationId, { year, month, search }),
    getWorkInjuryDeductionSummary(ctx.organizationId, { year, month }),
    availableWorkInjuryDeductionMonths(ctx.organizationId),
    ctx.isPlatformAdmin
      ? Promise.resolve(null)
      : prisma.userOrganizationRole
          .findMany({ where: { userId: ctx.userId, organizationId: ctx.organizationId }, include: { role: { include: { rolePermissions: { include: { permission: true } } } } } })
          .then((rows) => rows.flatMap((r) => r.role.rolePermissions.map((rp) => rp.permission.key))),
  ]);

  const canEdit = hasPermission(permissionKeys, PERMISSIONS.VIOLATION_EDIT);
  const canDelete = hasPermission(permissionKeys, PERMISSIONS.VIOLATION_DELETE);
  const canDownload = hasPermission(permissionKeys, PERMISSIONS.VIOLATION_DOWNLOAD);

  const rows = items.map((row) => ({
    id: row.id,
    employeeId: row.employeeId,
    employeeCodeSnapshot: row.employeeCodeSnapshot,
    fullNameZhSnapshot: row.fullNameZhSnapshot,
    fullNameViSnapshot: row.fullNameViSnapshot,
    orgUnitLevel1Snapshot: row.orgUnitLevel1Snapshot,
    regionSnapshot: row.regionSnapshot,
    orgUnitLevel2Snapshot: row.orgUnitLevel2Snapshot,
    teamSnapshot: row.teamSnapshot,
    shiftSnapshot: row.shiftSnapshot,
    positionSnapshot: row.positionSnapshot,
    accidentDate: row.accidentDate,
    reporterName: row.reporterName,
    fineAmountVnd: row.fineAmountVnd,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-end gap-3">
        {canDownload && (
          <a href={`/api/violations/lien-de/export?year=${year}&month=${month}`} className={buttonVariants({ variant: "outline" })}>
            <Download className="size-4" />
            <T k="violations.download.button" />
          </a>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card><CardHeader className="pb-2"><p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase"><T k="violationsLienDe.kpi.count" /></p><CardTitle className="text-2xl leading-none font-bold">{summary.count}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase"><T k="violationsLienDe.kpi.totalFine" /></p><CardTitle className="text-2xl leading-none font-bold text-destructive">{vnd(summary.totalFineVnd)}</CardTitle></CardHeader></Card>
      </div>

      <DeductionFilters year={year} month={month} search={search} options={monthOptions} />

      <DeductionTable items={rows} year={year} month={month} canEdit={canEdit} canDelete={canDelete} hiddenColumns={[...hiddenColumns]} />
    </div>
  );
}
