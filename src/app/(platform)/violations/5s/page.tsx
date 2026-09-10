import Link from "next/link";
import { cookies } from "next/headers";
import { Download } from "lucide-react";
import { tryApiAccess } from "@/server/api-guard";
import { NoPermissionState } from "@/components/no-permission-state";
import { PERMISSIONS } from "@/server/permissions";
import { prisma } from "@/lib/prisma";
import { listSafety5sViolations, getSafety5sViolationSummary, availableSafety5sViolationMonths } from "@/server/safety-5s-violations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Safety5sFilters } from "./filters";
import { Safety5sTable } from "./safety-5s-table";
import { SAFETY_5S_COLUMNS_COOKIE, SAFETY_5S_TOGGLEABLE_COLUMNS } from "./column-visibility";
import { parseHiddenColumns } from "@/lib/column-visibility";
import { T } from "@/components/i18n/t";

function hasPermission(permissionKeys: string[] | null, key: string) {
  return permissionKeys === null || permissionKeys.includes(key);
}

function vnd(n: number) {
  return `${n.toLocaleString("vi-VN")} đ`;
}

export default async function Violations5sPage({ searchParams }: PageProps<"/violations/5s">) {
  const access = await tryApiAccess(PERMISSIONS.VIOLATION_VIEW);
  if ("denied" in access) return <NoPermissionState />;
  const ctx = access;
  const params = await searchParams;
  const cookieStore = await cookies();
  const hiddenColumns = parseHiddenColumns(cookieStore.get(SAFETY_5S_COLUMNS_COOKIE)?.value, SAFETY_5S_TOGGLEABLE_COLUMNS);

  const now = new Date();
  const ymRaw = typeof params.ym === "string" ? params.ym : "";
  const [yRaw, mRaw] = ymRaw.split("-");
  const year = Number(yRaw) || now.getFullYear();
  const month = Number(mRaw) || now.getMonth() + 1;
  const search = typeof params.q === "string" && params.q !== "" ? params.q : undefined;

  const [items, summary, monthOptions, permissionKeys, contentCatalog] = await Promise.all([
    listSafety5sViolations(ctx.organizationId, { year, month, search }),
    getSafety5sViolationSummary(ctx.organizationId, { year, month }),
    availableSafety5sViolationMonths(ctx.organizationId),
    ctx.isPlatformAdmin
      ? Promise.resolve(null)
      : prisma.userOrganizationRole
          .findMany({ where: { userId: ctx.userId, organizationId: ctx.organizationId }, include: { role: { include: { rolePermissions: { include: { permission: true } } } } } })
          .then((rows) => rows.flatMap((r) => r.role.rolePermissions.map((rp) => rp.permission.key))),
    prisma.safety5sViolationContent.findMany({ where: { organizationId: ctx.organizationId, isActive: true }, orderBy: { sortOrder: "asc" } }),
  ]);

  // Insertion value matches the catalog's own "Vi - Zh" display format exactly, so picking a
  // preset fills the field with the same bilingual text an admin sees when managing the catalog.
  const contentOptions = contentCatalog.map((c) => {
    const combined = c.labelZh ? `${c.labelVi} - ${c.labelZh}` : c.labelVi;
    return { value: combined, label: combined };
  });

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
    violationContent: row.violationContent,
    violationDate: row.violationDate,
    fineAmountVnd: row.fineAmountVnd,
    note: row.note,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {canDownload && (
          <a href={`/api/violations/5s/export?year=${year}&month=${month}`} className={buttonVariants({ variant: "outline" })}>
            <Download className="size-4" />
            <T k="violations.download.button" />
          </a>
        )}
        {canEdit && (
          <Link href="/violations/5s/catalog" className={buttonVariants({ variant: "outline" })}>
            <T k="violations.catalog.title" />
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card><CardHeader className="pb-2"><p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase"><T k="violations5s.kpi.count" /></p><CardTitle className="text-2xl leading-none font-bold">{summary.count}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase"><T k="violations5s.kpi.totalFine" /></p><CardTitle className="text-2xl leading-none font-bold text-destructive">{vnd(summary.totalFineVnd)}</CardTitle></CardHeader></Card>
      </div>

      <Safety5sFilters year={year} month={month} search={search} options={monthOptions} />

      <Safety5sTable
        items={rows}
        year={year}
        month={month}
        canEdit={canEdit}
        canDelete={canDelete}
        hiddenColumns={[...hiddenColumns]}
        contentOptions={contentOptions}
      />
    </div>
  );
}
