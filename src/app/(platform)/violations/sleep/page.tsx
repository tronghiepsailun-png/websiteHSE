import Link from "next/link";
import { cookies } from "next/headers";
import { parseHiddenColumns } from "@/lib/column-visibility";
import { SLEEP_COLUMNS_COOKIE, SLEEP_TOGGLEABLE_COLUMNS } from "./column-visibility";
import { Download, ListTree } from "lucide-react";
import { tryApiAccess } from "@/server/api-guard";
import { NoPermissionState } from "@/components/no-permission-state";
import { PERMISSIONS } from "@/server/permissions";
import { prisma } from "@/lib/prisma";
import { listCatalogItems } from "@/server/catalog";
import {
  availableSleepViolationMonths,
  ensureSleepCatalogSeeded,
  listSleepViolations,
  SLEEP_DEFAULT_AMOUNTS,
  SLEEP_MODULE,
  summarizeSleepViolations,
} from "@/server/sleep-violations";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { T } from "@/components/i18n/t";
import type { DictionaryKey } from "@/lib/i18n/translate";
import { Safety5sFilters } from "../5s/filters";
import { SleepView, type SleepCatalogs, type SleepRow } from "./sleep-view";

function hasPermission(permissionKeys: string[] | null, key: string) {
  return permissionKeys === null || permissionKeys.includes(key);
}

function vnd(n: number) {
  return `${n.toLocaleString("vi-VN")} đ`;
}

export default async function SleepViolationsPage({ searchParams }: PageProps<"/violations/sleep">) {
  const access = await tryApiAccess(PERMISSIONS.VIOLATION_VIEW);
  if ("denied" in access) return <NoPermissionState />;
  const ctx = access;
  const params = await searchParams;

  const now = new Date();
  const [yRaw, mRaw] = (typeof params.ym === "string" ? params.ym : "").split("-");
  const year = Number(yRaw) || now.getFullYear();
  const month = Number(mRaw) || now.getMonth() + 1;
  const search = typeof params.q === "string" && params.q !== "" ? params.q : undefined;

  await ensureSleepCatalogSeeded(ctx.organizationId);

  const cookieStore = await cookies();
  const hiddenColumns = parseHiddenColumns(cookieStore.get(SLEEP_COLUMNS_COOKIE)?.value, SLEEP_TOGGLEABLE_COLUMNS);

  const [items, monthOptions, permissionKeys, locations, notes, guards] = await Promise.all([
    listSleepViolations(ctx.organizationId, { year, month, search }),
    availableSleepViolationMonths(ctx.organizationId),
    ctx.isPlatformAdmin
      ? Promise.resolve(null)
      : prisma.userOrganizationRole
          .findMany({ where: { userId: ctx.userId, organizationId: ctx.organizationId }, include: { role: { include: { rolePermissions: { include: { permission: true } } } } } })
          .then((rows) => rows.flatMap((r) => r.role.rolePermissions.map((rp) => rp.permission.key))),
    listCatalogItems(ctx.organizationId, SLEEP_MODULE, "location"),
    listCatalogItems(ctx.organizationId, SLEEP_MODULE, "note"),
    listCatalogItems(ctx.organizationId, SLEEP_MODULE, "guard"),
  ]);

  const canEdit = hasPermission(permissionKeys, PERMISSIONS.VIOLATION_EDIT);
  const canDelete = hasPermission(permissionKeys, PERMISSIONS.VIOLATION_DELETE);
  const canDownload = hasPermission(permissionKeys, PERMISSIONS.VIOLATION_DOWNLOAD);
  const summary = summarizeSleepViolations(items);

  const catalogs: SleepCatalogs = {
    locations: locations.filter((i) => i.isActive).map((i) => ({ value: i.nameVi, label: i.nameZh ? `${i.nameVi} — ${i.nameZh}` : i.nameVi })),
    notes: notes.filter((i) => i.isActive).map((i) => ({ vi: i.nameVi, zh: i.nameZh })),
    guards: guards.filter((i) => i.isActive).map((i) => ({ id: i.id, code: i.code, nameVi: i.nameVi, nameZh: i.nameZh, color: i.color })),
    defaults: SLEEP_DEFAULT_AMOUNTS,
  };

  const rows: SleepRow[] = items.map((r) => ({
    id: r.id,
    checkDate: r.checkDate.toISOString().slice(0, 10),
    checkTime: r.checkTime,
    location: r.location,
    employeeId: r.employeeId,
    employeeCode: r.employeeCode,
    employeeName: r.employeeName,
    factory: r.factory,
    department: r.department,
    position: r.position,
    fineAmountVnd: r.fineAmountVnd,
    note: r.note,
    liableEmployeeId: r.liableEmployeeId,
    liableCode: r.liableCode,
    liableName: r.liableName,
    liableFineVnd: r.liableFineVnd,
    guardCatalogId: r.guardCatalogId,
    guardCode: r.guardCode,
    guardNameZh: r.guardNameZh,
    guardNameVi: r.guardNameVi,
    guardColor: r.guardColor,
    guardRewardVnd: r.guardRewardVnd,
    remark: r.remark,
  }));

  const kpi = (labelKey: DictionaryKey, value: string, className?: string) => (
    <Card>
      <CardHeader className="pb-2">
        <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          <T k={labelKey} />
        </p>
        <CardTitle className={`text-2xl leading-none font-semibold tabular-nums ${className ?? ""}`}>{value}</CardTitle>
      </CardHeader>
    </Card>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {canDownload && (
          <a href={`/api/violations/sleep/export?year=${year}&month=${month}`} className={buttonVariants({ variant: "outline" })}>
            <Download className="size-4" />
            <T k="violations.download.button" />
          </a>
        )}
        {canEdit && (
          <Link href="/violations/sleep/catalog" className={buttonVariants({ variant: "outline" })}>
            <ListTree className="size-4" />
            <T k="violations.catalog.title" />
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpi("sleep.kpi.count", String(summary.count))}
        {kpi("sleep.kpi.fine", vnd(summary.fine), "text-destructive")}
        {kpi("sleep.kpi.liable", vnd(summary.liable), "text-warning")}
        {kpi("sleep.kpi.reward", vnd(summary.reward), "text-success")}
      </div>

      <Safety5sFilters year={year} month={month} search={search} options={monthOptions} basePath="/violations/sleep" />

      <SleepView rows={rows} catalogs={catalogs} canEdit={canEdit} canDelete={canDelete} hiddenColumns={[...hiddenColumns]} year={year} month={month} />
    </div>
  );
}
