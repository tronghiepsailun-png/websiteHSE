import Link from "next/link";
import { ShieldAlert, Wallet, CalendarCheck, TrendingDown } from "lucide-react";
import { requireApiAccess } from "@/server/api-guard";
import { PERMISSIONS } from "@/server/permissions";
import { listIncidents, getIncidentDashboardData } from "@/server/incidents";
import { prisma } from "@/lib/prisma";
import { formatIncidentCost } from "@/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { SeverityBadge, IncidentStatusBadge } from "@/components/incidents/severity-badge";
import { TopNBarChart } from "@/components/charts/top-n-bar-chart";
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
  const ctx = await requireApiAccess(PERMISSIONS.INCIDENT_VIEW);
  const params = await searchParams;

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
    prisma.orgUnit.findMany({ where: { organizationId: ctx.organizationId, isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    ctx.isPlatformAdmin ? Promise.resolve(null) : prisma.userOrganizationRole
        .findMany({ where: { userId: ctx.userId, organizationId: ctx.organizationId }, include: { role: { include: { rolePermissions: { include: { permission: true } } } } } })
        .then((rows) => rows.flatMap((r) => r.role.rolePermissions.map((rp) => rp.permission.key))),
  ]);

  const canCreate = hasPermission(permissionKeys, PERMISSIONS.INCIDENT_CREATE);
  const canDelete = hasPermission(permissionKeys, PERMISSIONS.INCIDENT_DELETE);

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">
            <T k="incidents.moduleName" />
          </h1>
          <p className="text-sm text-muted-foreground">
            <T k="incidents.pageSubtitle" />
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a href="/api/incidents/export" className={buttonVariants({ variant: "outline" })}>
            <T k="incidents.download.button" />
          </a>
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
        <TopNBarChart
          titleKey="incidents.chart.byDepartment"
          data={dashboard.byDepartment}
          topN={8}
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
        <DonutChart
          titleKey="incidents.chart.byInjuredBodyPart"
          data={dashboard.byInjuredBodyPart}
          topN={6}
          filterParam="injuredBodyPart"
        />
        <TrendLineChart titleKey="incidents.chart.trendCost" data={costTrend} metric="cost" />
      </div>

      {/* 4. Incident list — search/filter/view-details kept as-is */}
      <h2 id="incidents-list" className="scroll-mt-4 text-lg font-semibold">
        <T k="incidents.dashboard.listTitle" />
      </h2>

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
                <TableHead><T k="incidents.table.number" /></TableHead>
                <TableHead><T k="incidents.table.occurred" /></TableHead>
                <TableHead><T k="incidents.table.department" /></TableHead>
                <TableHead><T k="incidents.table.location" /></TableHead>
                <TableHead><T k="incidents.table.category" /></TableHead>
                <TableHead><T k="incidents.table.severity" /></TableHead>
                <TableHead><T k="incidents.table.employee" /></TableHead>
                <TableHead className="text-right"><T k="incidents.table.cost" /></TableHead>
                <TableHead><T k="common.status" /></TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleIncidents.map((incident) => (
                <TableRow key={incident.id} className="h-14">
                  <TableCell className="py-3">
                    <Link href={`/incidents/${incident.id}`} className="font-medium text-primary hover:underline">
                      {incident.incidentNumber}
                    </Link>
                  </TableCell>
                  <TableCell className="py-3">{incident.occurredAt.toLocaleDateString()}</TableCell>
                  <TableCell className="py-3">{incident.orgUnit?.name ?? incident.departmentSnapshot ?? "—"}</TableCell>
                  <TableCell className="py-3">{incident.locationDetail ?? "—"}</TableCell>
                  <TableCell className="py-3">{incident.category.name}</TableCell>
                  <TableCell className="py-3">
                    <SeverityBadge name={incident.severity.name} colorHex={incident.severity.colorHex} />
                  </TableCell>
                  <TableCell className="py-3">{incident.employeeNameSnapshot ?? "—"}</TableCell>
                  <TableCell className="py-3 text-right whitespace-nowrap">{formatIncidentCost(incident)}</TableCell>
                  <TableCell className="py-3">
                    <IncidentStatusBadge status={incident.status} />
                  </TableCell>
                  <TableCell className="py-3 text-right">
                    <IncidentRowActions incidentId={incident.id} incidentNumber={incident.incidentNumber} canDelete={canDelete} />
                  </TableCell>
                </TableRow>
              ))}
              {incidents.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10}>
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
