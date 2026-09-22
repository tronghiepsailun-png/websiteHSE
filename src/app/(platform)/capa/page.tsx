import { cookies } from "next/headers";
import { ClipboardCheck, ListChecks, AlertTriangle, CheckCircle2 } from "lucide-react";
import { tryApiAccess } from "@/server/api-guard";
import { NoPermissionState } from "@/components/no-permission-state";
import { PERMISSIONS } from "@/server/permissions";
import { listCapaForOrg, getCapaSummary, getCapaDeptBreakdown, daysUnresolved, getCapaPhotosMap } from "@/server/capa";
import { listActiveSafetyWorkshops } from "@/server/inventory";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { KpiCard, KPI_CARD_WIDTH_CLASS } from "@/components/ui/kpi-card";
import { HorizontalScroll } from "@/components/ui/horizontal-scroll";
import { TopNBarChart } from "@/components/charts/top-n-bar-chart";
import { TopNVerticalBarChart } from "@/components/charts/top-n-vertical-bar-chart";
import { DonutChart } from "@/components/charts/donut-chart";
import type { ChartDatum } from "@/components/charts/chart-utils";
import { CAPA_CLASSIFICATIONS } from "@/lib/capa-constants";
import { t, type DictionaryKey } from "@/lib/i18n/translate";
import { CapaFilters } from "./capa-filters";
import { CapaTable, type CapaRowData } from "./capa-table";
import { CapaBoard } from "./capa-board";
import { ViewModeTabs } from "@/components/ui/view-mode-tabs";
import { CAPA_COLUMNS_COOKIE, CAPA_TOGGLEABLE_COLUMNS } from "./column-visibility";
import { T } from "@/components/i18n/t";
import { getLocale } from "@/lib/i18n/get-locale.server";
import { parseHiddenColumns } from "@/lib/column-visibility";

function hasPermission(permissionKeys: string[] | null, key: string) {
  return permissionKeys === null || permissionKeys.includes(key);
}

// Fixed, distinct color per classification — a categorical breakdown of a handful of known
// types reads better with each slice visibly different than with the shared brand-green ramp
// (which only varies by opacity and looks like near-duplicates with few segments).
const CLASSIFICATION_COLOR: Record<(typeof CAPA_CLASSIFICATIONS)[number], string> = {
  hazard: "#f59e0b",
  strict_equipment: "#ef4444",
  safety_equipment: "#3b82f6",
  fire_safety: "#f97316",
  electrical: "#eab308",
  environment: "#10b981",
};

/** The status/classification Selects submit the literal string "all" for "no filter
 *  selected" — treat that as unset. */
function parseFilterParam(value: unknown): string | undefined {
  if (typeof value !== "string" || value === "" || value === "all") return undefined;
  return value;
}

export default async function CapaPage({ searchParams }: PageProps<"/capa">) {
  const access = await tryApiAccess(PERMISSIONS.CAPA_VIEW);
  if ("denied" in access) return <NoPermissionState />;
  const ctx = access;
  const locale = await getLocale();
  const params = await searchParams;
  const cookieStore = await cookies();
  const hiddenColumns = parseHiddenColumns(cookieStore.get(CAPA_COLUMNS_COOKIE)?.value, CAPA_TOGGLEABLE_COLUMNS);
  const status = parseFilterParam(params.status);
  const classification = parseFilterParam(params.classification);
  const search = typeof params.q === "string" && params.q !== "" ? params.q : undefined;
  const view = params.view === "board" ? "board" : "table";

  const [capaItems, summary, deptBreakdown, permissionKeys, workshopsRaw] = await Promise.all([
    listCapaForOrg(ctx.organizationId, { status, classification, search }),
    getCapaSummary(ctx.organizationId),
    getCapaDeptBreakdown(ctx.organizationId),
    ctx.isPlatformAdmin
      ? Promise.resolve(null)
      : prisma.userOrganizationRole
          .findMany({ where: { userId: ctx.userId, organizationId: ctx.organizationId }, include: { role: { include: { rolePermissions: { include: { permission: true } } } } } })
          .then((rows) => rows.flatMap((r) => r.role.rolePermissions.map((rp) => rp.permission.key))),
    listActiveSafetyWorkshops(ctx.organizationId),
  ]);

  const workshops = workshopsRaw.map((w) => ({ id: w.id, name: locale === "vi" && w.nameVi ? w.nameVi : w.name }));

  // "area"/"responsibleDept" are stored as the plain workshop name that was selected at
  // save time, in whichever locale was active then — so a row saved in Vietnamese still
  // showed its Vietnamese name after switching to Chinese. Re-resolve against the catalog
  // (matching either language) and re-render in the current locale on every read.
  function localizeWorkshopValue(value: string | null): string | null {
    if (!value) return value;
    const match = workshopsRaw.find((w) => w.name === value || w.nameVi === value);
    if (!match) return value;
    return locale === "vi" && match.nameVi ? match.nameVi : match.name;
  }

  // Two views of the same breakdown: how many issues each department has raised in total,
  // and — the one that actually needs attention — how many of those are still unresolved.
  const totalByDept = new Map<string, number>();
  const unresolvedByDept = new Map<string, number>();
  for (const row of deptBreakdown) {
    const dept = localizeWorkshopValue(row.responsibleDept);
    if (!dept) continue;
    totalByDept.set(dept, (totalByDept.get(dept) ?? 0) + 1);
    if (row.status !== "completed" && row.status !== "closed") {
      unresolvedByDept.set(dept, (unresolvedByDept.get(dept) ?? 0) + 1);
    }
  }
  const toSortedChartData = (map: Map<string, number>): ChartDatum[] =>
    Array.from(map.entries())
      .map(([key, value]) => ({ key, value }))
      .sort((a, b) => b.value - a.value);
  const totalByDeptData = toSortedChartData(totalByDept);
  const unresolvedByDeptData = toSortedChartData(unresolvedByDept);

  const byClassification = new Map<string, number>();
  const byClassificationColorMap: Record<string, string> = {};
  for (const row of deptBreakdown) {
    if (!row.classification) continue;
    const isKnown = CAPA_CLASSIFICATIONS.includes(row.classification as (typeof CAPA_CLASSIFICATIONS)[number]);
    const label = isKnown ? t(locale, `capa.classification.${row.classification}` as DictionaryKey) : row.classification;
    byClassification.set(label, (byClassification.get(label) ?? 0) + 1);
    if (isKnown) byClassificationColorMap[label] = CLASSIFICATION_COLOR[row.classification as (typeof CAPA_CLASSIFICATIONS)[number]];
  }
  const byClassificationData = toSortedChartData(byClassification);

  const canCreate = hasPermission(permissionKeys, PERMISSIONS.CAPA_CREATE);
  const canEdit = hasPermission(permissionKeys, PERMISSIONS.CAPA_EDIT);
  const canDelete = hasPermission(permissionKeys, PERMISSIONS.CAPA_DELETE);

  const photosMap = await getCapaPhotosMap(
    ctx.organizationId,
    capaItems.map((c) => c.id)
  );

  const rows: CapaRowData[] = capaItems.map((c) => {
    const photos = photosMap.get(c.id) ?? { before: null, after: null };
    return {
      id: c.id,
      area: localizeWorkshopValue(c.area),
      action: c.action,
      discoveredDate: c.discoveredDate,
      classification: c.classification,
      responsibleDept: localizeWorkshopValue(c.responsibleDept),
      dueDate: c.dueDate,
      completionDate: c.completionDate,
      status: c.status,
      daysUnresolved: daysUnresolved(c),
      before: photos.before,
      after: photos.after,
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600">
            <ClipboardCheck className="size-5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold"><T k="nav.capa" /></h1>
            <p className="hidden text-sm text-muted-foreground md:block"><T k="capa.pageSubtitle" /></p>
          </div>
        </CardContent>
      </Card>

      <HorizontalScroll className="flex gap-3 md:grid md:grid-cols-3">
        <div className={KPI_CARD_WIDTH_CLASS}>
          <KpiCard labelKey="capa.kpi.total" value={summary.total} icon={ListChecks} tone="neutral" />
        </div>
        <div className={KPI_CARD_WIDTH_CLASS}>
          <KpiCard labelKey="capa.kpi.overdue" value={summary.overdue} icon={AlertTriangle} tone="critical" />
        </div>
        <div className={KPI_CARD_WIDTH_CLASS}>
          <KpiCard labelKey="capa.kpi.completed" value={summary.completed} icon={CheckCircle2} tone="success" />
        </div>
      </HorizontalScroll>

      {(totalByDeptData.length > 0 || byClassificationData.length > 0) && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <TopNBarChart titleKey="capa.chart.byDepartment" data={totalByDeptData} topN={8} />
          <DonutChart titleKey="capa.chart.byClassification" data={byClassificationData} topN={6} colorMap={byClassificationColorMap} />
        </div>
      )}

      {unresolvedByDeptData.length > 0 && <TopNVerticalBarChart titleKey="capa.chart.unresolvedByDepartment" data={unresolvedByDeptData} />}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <CapaFilters search={search} status={status} classification={classification} />
        <ViewModeTabs active={view} basePath="/capa" searchParams={params} locale={locale} />
      </div>

      {view === "board" ? (
        <CapaBoard items={rows} canEdit={canEdit} />
      ) : (
        <CapaTable items={rows} workshops={workshops} canCreate={canCreate} canEdit={canEdit} canDelete={canDelete} hiddenColumns={[...hiddenColumns]} />
      )}
    </div>
  );
}
