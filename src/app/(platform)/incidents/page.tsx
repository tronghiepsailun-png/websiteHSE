import Link from "next/link";
import { cookies } from "next/headers";
import { ShieldAlert, Wallet, CalendarCheck, TrendingDown, Download } from "lucide-react";
import { tryApiAccess } from "@/server/api-guard";
import { NoPermissionState } from "@/components/no-permission-state";
import { PERMISSIONS } from "@/server/permissions";
import {
  listIncidents,
  getIncidentDashboardData,
  getIncidentFactoryCode,
  localizeCategoryName,
  localizeDepartmentName,
  buildOrgUnitNameViMap,
  resolveEmployeeSnapshotNames,
  localizeEmployeeDisplayName,
} from "@/server/incidents";
import { getLocale } from "@/lib/i18n/get-locale.server";
import { prisma } from "@/lib/prisma";
import { formatIncidentCost } from "@/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { SeverityBadge, IncidentStatusBadge } from "@/components/incidents/severity-badge";
import { TopNBarChart } from "@/components/charts/top-n-bar-chart";
import { TopNVerticalBarChart } from "@/components/charts/top-n-vertical-bar-chart";
import { DonutChart } from "@/components/charts/donut-chart";
import { TrendLineChart } from "@/components/charts/trend-line-chart";
import { IncidentFilters } from "./incident-filters";
import { DashboardFilters } from "./dashboard-filters";
import { ImportDialog } from "./import-dialog";
import { IncidentRowActions } from "./[id]/incident-row-actions";
import { DaysSinceValue } from "./days-since-value";
import { EmptyState } from "@/components/ui/empty-state";
import { TablePagination } from "@/components/ui/table-pagination";
import { T } from "@/components/i18n/t";
import { ModuleHeader } from "./module-header";
import { parseReportView } from "./report-view";
import { ReportYearFilter } from "./report-year-filter";
import { Sheet02Crosstab } from "./sheet02-crosstab";
import { Sheet03ScoreTable } from "./sheet03-score-table";
import { Sheet04DeductionTable } from "./sheet04-deduction-table";
import { Sheet05KpiTable } from "./sheet05-kpi-table";
import {
  getAvailableReportYears,
  getSheet02CrosstabData,
  getSheet03ScoreData,
  getSheet04DeductionData,
  getSheet05KpiData,
} from "@/server/incident-reports";
import { ColumnVisibilityMenu } from "@/components/ui/column-visibility-menu";
import { parseHiddenColumns, type ToggleableColumn } from "@/lib/column-visibility";

const INCIDENT_COLUMNS_COOKIE = "incidents_hidden_columns";

const INCIDENT_TOGGLEABLE_COLUMNS: ToggleableColumn[] = [
  { id: "factoryCode", labelKey: "incidents.table.factoryCode" },
  { id: "occurred", labelKey: "incidents.table.occurred" },
  { id: "department", labelKey: "incidents.table.department" },
  { id: "location", labelKey: "incidents.table.location" },
  { id: "category", labelKey: "incidents.table.category" },
  { id: "severity", labelKey: "incidents.table.severity" },
  { id: "employee", labelKey: "incidents.new.fields.employee" },
  { id: "cost", labelKey: "incidents.table.cost" },
  { id: "status", labelKey: "common.status" },
];

const LIST_PAGE_SIZE = 20;

function hasPermission(permissionKeys: string[] | null, key: string) {
  return permissionKeys === null || permissionKeys.includes(key);
}

/** The filter Selects submit the literal string "all" for "no filter selected" — treat that (and blanks) as unset. */
function parseFilterParam(value: unknown): string | undefined {
  if (typeof value !== "string" || value === "" || value === "all") return undefined;
  return value;
}

function parseNumberParam(value: unknown): number | undefined {
  const raw = parseFilterParam(value);
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export default async function IncidentsPage({ searchParams }: PageProps<"/incidents">) {
  const access = await tryApiAccess(PERMISSIONS.INCIDENT_VIEW);
  if ("denied" in access) return <NoPermissionState />;
  const ctx = access;
  const locale = await getLocale();
  const params = await searchParams;
  const view = parseReportView(params.view);
  const cookieStore = await cookies();
  const hiddenColumns = parseHiddenColumns(cookieStore.get(INCIDENT_COLUMNS_COOKIE)?.value, INCIDENT_TOGGLEABLE_COLUMNS);

  if (view !== "detail") {
    const now = new Date();
    const availableYears = await getAvailableReportYears(ctx.organizationId);
    const year = parseNumberParam(params.year) ?? now.getFullYear();

    const titleKey =
      view === "stats"
        ? "incidents.report.stats.title"
        : view === "score"
          ? "incidents.report.score.title"
          : view === "deduction"
            ? "incidents.report.deduction.title"
            : "incidents.report.kpi.title";
    const subtitleKey =
      view === "stats"
        ? "incidents.report.stats.subtitle"
        : view === "score"
          ? "incidents.report.score.subtitle"
          : view === "deduction"
            ? "incidents.report.deduction.subtitle"
            : "incidents.report.kpi.subtitle";

    return (
      <div className="flex flex-col gap-6">
        <ModuleHeader active={view} />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">
              <T k={titleKey} />
            </h2>
            <p className="text-sm text-muted-foreground">
              <T k={subtitleKey} />
            </p>
          </div>
          <ReportYearFilter view={view} year={year} availableYears={availableYears} />
        </div>

        {view === "stats" && <Sheet02Crosstab data={await getSheet02CrosstabData(ctx.organizationId, year)} />}
        {view === "score" && <Sheet03ScoreTable data={await getSheet03ScoreData(ctx.organizationId, year)} />}
        {view === "deduction" && <Sheet04DeductionTable data={await getSheet04DeductionData(ctx.organizationId, year)} />}
        {view === "kpi" && <Sheet05KpiTable data={await getSheet05KpiData(ctx.organizationId, year)} />}
      </div>
    );
  }

  // List section filters (search/status/category/severity) — unchanged from before.
  const status = parseFilterParam(params.status);
  const severityId = parseFilterParam(params.severityId);
  const categoryId = parseFilterParam(params.categoryId);
  const search = typeof params.q === "string" && params.q !== "" ? params.q : undefined;
  // Drill-down filters, set only by clicking a chart segment (no visible dropdown for these).
  const drillOrgUnitId = parseFilterParam(params.orgUnitId);
  const drillInjuredBodyPart = parseFilterParam(params.injuredBodyPart);

  // Dashboard filter (Year / Month / Week / Department) — drives KPIs + charts only.
  const dYear = parseNumberParam(params.dYear);
  const dMonth = parseNumberParam(params.dMonth);
  const dWeek = parseNumberParam(params.dWeek);
  const dOrgUnitId = parseFilterParam(params.dOrgUnitId);

  const [incidents, dashboard, categories, severities, orgUnits, permissionKeys] = await Promise.all([
    listIncidents(ctx.organizationId, {
      status,
      severityId,
      categoryId,
      search,
      orgUnitId: drillOrgUnitId,
      injuredBodyPart: drillInjuredBodyPart,
    }),
    getIncidentDashboardData(ctx.organizationId, { year: dYear, month: dMonth, week: dWeek, orgUnitId: dOrgUnitId }),
    prisma.incidentCategory.findMany({ where: { organizationId: ctx.organizationId, isActive: true }, orderBy: { sortOrder: "asc" } }),
    prisma.incidentSeverity.findMany({ where: { organizationId: ctx.organizationId, isActive: true }, orderBy: { rank: "desc" } }),
    // Department-level units only — "Site" (Khu A/B/C) are PCCC record zones, not a place an
    // incident happened, and don't belong in this filter.
    prisma.orgUnit.findMany({ where: { organizationId: ctx.organizationId, isActive: true, unitType: { code: "DEPT" } }, orderBy: { name: "asc" }, select: { id: true, name: true, nameVi: true } }),
    ctx.isPlatformAdmin ? Promise.resolve(null) : prisma.userOrganizationRole
        .findMany({ where: { userId: ctx.userId, organizationId: ctx.organizationId }, include: { role: { include: { rolePermissions: { include: { permission: true } } } } } })
        .then((rows) => rows.flatMap((r) => r.role.rolePermissions.map((rp) => rp.permission.key))),
  ]);

  const canCreate = hasPermission(permissionKeys, PERMISSIONS.INCIDENT_CREATE);
  const canDelete = hasPermission(permissionKeys, PERMISSIONS.INCIDENT_DELETE);
  const canDownload = hasPermission(permissionKeys, PERMISSIONS.INCIDENT_DOWNLOAD);

  // "Bộ phận"/"Nhân viên bị thương" need to display in whichever locale is active even for
  // incidents whose department/employee only ever exist as a plain snapshot string (older
  // imports) rather than a live catalog link — see localizeDepartmentName/
  // localizeEmployeeDisplayName in server/incidents.ts.
  const nameViByName = buildOrgUnitNameViMap(orgUnits);
  const employeeSnapshotNamesByCode = await resolveEmployeeSnapshotNames(ctx.organizationId, incidents);

  const totalCostDisplay =
    dashboard.totalIncidents === 0
      ? formatIncidentCost({ costVnd: null, costRmb: null })
      : formatIncidentCost({ costVnd: dashboard.totalCostVnd, costRmb: dashboard.totalCostRmb || null });

  // Charts group by display name, but drill-down needs the underlying id (department/category).
  // Plain objects, not Maps/functions — client chart components receive this as a serialized prop.
  const orgUnitIdByName = Object.fromEntries(orgUnits.map((u) => [u.name, u.id]));
  const categoryIdByName = Object.fromEntries(categories.map((c) => [c.name, c.id]));
  // Each severity's own tenant-configured color (green→red by rank) — read straight from the
  // DB, not hardcoded, so the donut always matches whatever a tenant has configured.
  const severityColorByName = Object.fromEntries(
    severities.filter((s) => s.colorHex).map((s) => [s.name, s.colorHex as string])
  );

  const incidentTrend = dashboard.incidentTrendByMonth.map((m) => ({ month: m.month, value: m.count }));
  const costTrend = dashboard.costTrendByMonth.map((m) => ({ month: m.month, value: m.costVnd }));

  // Drill-down filters set only via chart clicks — show a clearable chip when active,
  // building the "remove just this one param" URL from the current query string.
  const clearParams = (keys: string[]) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (keys.includes(key) || typeof value !== "string") continue;
      next.set(key, value);
    }
    return `/incidents${next.toString() ? `?${next.toString()}` : ""}#incidents-list`;
  };
  const activeDrillDownChips = [
    drillOrgUnitId ? { label: orgUnits.find((u) => u.id === drillOrgUnitId)?.name ?? drillOrgUnitId, href: clearParams(["orgUnitId"]) } : null,
    drillInjuredBodyPart ? { label: drillInjuredBodyPart, href: clearParams(["injuredBodyPart"]) } : null,
  ].filter((c): c is { label: string; href: string } => c !== null);

  // List pagination — 20 rows by default, with a "view all" escape hatch. Purely a rendering
  // slice of the already-fetched, already-filtered `incidents` array; no new query/data logic.
  const listPage = Math.max(1, Number(params.page) || 1);
  const listViewAll = params.viewAll === "1";
  const listTotalPages = Math.max(1, Math.ceil(incidents.length / LIST_PAGE_SIZE));
  const listPageClamped = Math.min(listPage, listTotalPages);
  const visibleIncidents = listViewAll
    ? incidents
    : incidents.slice((listPageClamped - 1) * LIST_PAGE_SIZE, listPageClamped * LIST_PAGE_SIZE);

  return (
    <div className="flex flex-col gap-6">
      <ModuleHeader active="detail" />

      <div className="flex flex-wrap items-center justify-end gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {canDownload && (
            <a href="/api/incidents/export" className={buttonVariants({ variant: "outline" })}>
              <Download className="size-4" />
              <T k="incidents.download.button" />
            </a>
          )}
          {canCreate && <ImportDialog />}
          {canCreate && (
            <Link href="/incidents/new" className={buttonVariants()}>
              <T k="incidents.reportButton" />
            </Link>
          )}
        </div>
      </div>

      {/* 1. Dashboard filter bar — Year / Month / Week / Department, drives KPIs + charts below */}
      <DashboardFilters
        year={dYear}
        month={dMonth}
        week={dWeek}
        orgUnitId={dOrgUnitId}
        availableYears={dashboard.availableYears}
        orgUnits={orgUnits}
        carry={{ q: search, status, categoryId, severityId }}
      />

      {/* 2. KPI — each card carries a restrained accent (icon + border tint) mapped to its
          meaning: green=safety volume, blue=cost/data, amber=warning, purple=special metric. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="border-green-500/20 shadow-[0_0_24px_-18px_rgba(34,197,94,0.6)]">
          <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
            <div>
              <CardDescription className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                <T k="incidents.kpi.totalIncidents" />
              </CardDescription>
              <CardTitle className="text-[26px] leading-none font-bold">{dashboard.totalIncidents}</CardTitle>
            </div>
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-green-500/10 text-green-500">
              <ShieldAlert className="size-4.5" />
            </div>
          </CardHeader>
        </Card>
        <Card className="border-blue-500/20 shadow-[0_0_24px_-18px_rgba(59,130,246,0.6)]">
          <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
            <div>
              <CardDescription className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                <T k="incidents.kpi.totalCost" />
              </CardDescription>
              <CardTitle className="text-[20px] leading-tight font-bold">{totalCostDisplay}</CardTitle>
            </div>
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
              <Wallet className="size-4.5" />
            </div>
          </CardHeader>
        </Card>
        <Card className="border-amber-500/20 shadow-[0_0_24px_-18px_rgba(251,191,36,0.6)]">
          <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
            <div>
              <CardDescription className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                <T k="incidents.kpi.daysSinceLastIncident" />
              </CardDescription>
              <CardTitle className="text-[26px] leading-none font-bold">
                <DaysSinceValue days={dashboard.daysSinceLastIncident} />
              </CardTitle>
            </div>
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
              <CalendarCheck className="size-4.5" />
            </div>
          </CardHeader>
        </Card>
        <Card className="border-purple-500/20 shadow-[0_0_24px_-18px_rgba(168,85,247,0.6)]">
          <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
            <div>
              <CardDescription className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                <T k="incidents.kpi.totalPointsDeducted" />
              </CardDescription>
              <CardTitle className="text-[26px] leading-none font-bold">{dashboard.totalPointsDeducted.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}</CardTitle>
            </div>
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-purple-500">
              <TrendingDown className="size-4.5" />
            </div>
          </CardHeader>
        </Card>
      </div>

      {/* 3. Charts — Row 2: trend + severity, Row 3: department + category, Row 4: injured body part + cost trend */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TrendLineChart titleKey="incidents.chart.trendIncidents" data={incidentTrend} metric="count" />
        <DonutChart titleKey="incidents.chart.bySeverity" data={dashboard.bySeverity} topN={8} colorMap={severityColorByName} />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TopNVerticalBarChart
          titleKey="incidents.chart.byDepartment"
          data={dashboard.byDepartment}
          filterParam="orgUnitId"
          resolveMap={orgUnitIdByName}
        />
        <TopNBarChart
          titleKey="incidents.chart.byCategory"
          data={dashboard.byCategory}
          topN={8}
          filterParam="categoryId"
          resolveMap={categoryIdByName}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TopNBarChart
          titleKey="incidents.chart.byInjuredBodyPart"
          data={dashboard.byInjuredBodyPart}
          topN={8}
          filterParam="injuredBodyPart"
        />
        <TrendLineChart titleKey="incidents.chart.trendCost" data={costTrend} metric="cost" />
      </div>

      {/* 4. Incident list — search/filter/view-details kept as-is */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="incidents-list" className="scroll-mt-4 text-lg font-semibold">
          <T k="incidents.dashboard.listTitle" />
        </h2>
        <ColumnVisibilityMenu columns={INCIDENT_TOGGLEABLE_COLUMNS} hiddenColumns={[...hiddenColumns]} cookieName={INCIDENT_COLUMNS_COOKIE} />
      </div>

      <IncidentFilters
        search={search}
        status={status}
        categoryId={categoryId}
        severityId={severityId}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        severities={severities.map((s) => ({ id: s.id, name: s.name }))}
        carry={{ year: dYear, month: dMonth, week: dWeek, orgUnitId: dOrgUnitId }}
      />

      {activeDrillDownChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground"><T k="incidents.chart.filteredBy" /></span>
          {activeDrillDownChips.map((chip) => (
            <a
              key={chip.label}
              href={chip.href}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-primary hover:bg-primary/20"
            >
              {chip.label}
              <span aria-hidden>✕</span>
            </a>
          ))}
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow className="h-11">
                <TableHead><T k="incidents.table.stt" /></TableHead>
                <TableHead><T k="incidents.table.number" /></TableHead>
                {!hiddenColumns.has("factoryCode") && <TableHead><T k="incidents.table.factoryCode" /></TableHead>}
                {!hiddenColumns.has("occurred") && <TableHead><T k="incidents.table.occurred" /></TableHead>}
                {!hiddenColumns.has("department") && <TableHead><T k="incidents.table.department" /></TableHead>}
                {!hiddenColumns.has("location") && <TableHead><T k="incidents.table.location" /></TableHead>}
                {!hiddenColumns.has("category") && <TableHead><T k="incidents.table.category" /></TableHead>}
                {!hiddenColumns.has("severity") && <TableHead><T k="incidents.table.severity" /></TableHead>}
                {!hiddenColumns.has("employee") && <TableHead><T k="incidents.new.fields.employee" /></TableHead>}
                {!hiddenColumns.has("cost") && <TableHead className="text-right"><T k="incidents.table.cost" /></TableHead>}
                {!hiddenColumns.has("status") && <TableHead><T k="common.status" /></TableHead>}
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleIncidents.map((incident, i) => (
                <TableRow key={incident.id} className="h-14">
                  <TableCell className="py-3 text-muted-foreground">
                    {incidents.length - (listViewAll ? 0 : (listPageClamped - 1) * LIST_PAGE_SIZE) - i}
                  </TableCell>
                  <TableCell className="py-3">
                    <Link href={`/incidents/${incident.id}`} className="font-medium text-primary hover:underline">
                      {incident.incidentNumber}
                    </Link>
                  </TableCell>
                  {!hiddenColumns.has("factoryCode") && (
                    <TableCell className="py-3 font-semibold">{getIncidentFactoryCode(incident)}</TableCell>
                  )}
                  {!hiddenColumns.has("occurred") && <TableCell className="py-3">{incident.occurredAt.toLocaleDateString()}</TableCell>}
                  {!hiddenColumns.has("department") && (
                    <TableCell className="py-3">
                      {localizeDepartmentName(incident.orgUnit?.name ?? incident.departmentSnapshot ?? null, locale, nameViByName)}
                    </TableCell>
                  )}
                  {!hiddenColumns.has("location") && <TableCell className="py-3">{incident.locationDetail ?? "—"}</TableCell>}
                  {!hiddenColumns.has("category") && <TableCell className="py-3">{localizeCategoryName(incident.category, locale)}</TableCell>}
                  {!hiddenColumns.has("severity") && (
                    <TableCell className="py-3">
                      <SeverityBadge name={incident.severity.name} colorHex={incident.severity.colorHex} />
                    </TableCell>
                  )}
                  {!hiddenColumns.has("employee") && (
                    <TableCell className="py-3">{localizeEmployeeDisplayName(incident, employeeSnapshotNamesByCode)}</TableCell>
                  )}
                  {!hiddenColumns.has("cost") && (
                    <TableCell className="py-3 text-right whitespace-nowrap">{formatIncidentCost(incident)}</TableCell>
                  )}
                  {!hiddenColumns.has("status") && (
                    <TableCell className="py-3">
                      <IncidentStatusBadge status={incident.status} />
                    </TableCell>
                  )}
                  <TableCell className="py-3 text-right">
                    <IncidentRowActions incidentId={incident.id} incidentNumber={incident.incidentNumber} canDelete={canDelete} />
                  </TableCell>
                </TableRow>
              ))}
              {incidents.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3 + INCIDENT_TOGGLEABLE_COLUMNS.length - hiddenColumns.size}>
                    <EmptyState message={<T k="incidents.table.noResults" />} />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <TablePagination
            total={incidents.length}
            page={listPageClamped}
            pageSize={LIST_PAGE_SIZE}
            viewAll={listViewAll}
            unitLabelKey="incidents.unitLabel"
            basePath="/incidents"
            searchParams={params}
            hash="#incidents-list"
          />
        </CardContent>
      </Card>
    </div>
  );
}
