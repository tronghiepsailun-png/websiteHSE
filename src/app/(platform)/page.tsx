import Link from "next/link";
import Image from "next/image";
import {
  AlertTriangle,
  IdCard,
  FileCheck2,
  ClipboardCheck,
  ShieldX,
  Warehouse,
  ListTodo,
  Lock,
  PackageX,
} from "lucide-react";
import { requireApiAccess } from "@/server/api-guard";
import { PERMISSIONS } from "@/server/permissions";
import { getPermissionKeysForUserInOrg } from "@/server/rbac";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { T } from "@/components/i18n/t";
import { t } from "@/lib/i18n/translate";
import { getLocale } from "@/lib/i18n/get-locale.server";
import type { DictionaryKey } from "@/lib/i18n/translate";
import { getIncidentDashboardData } from "@/server/incidents";
import { getCapaSummary } from "@/server/capa";
import { listViolations } from "@/server/violations";
import { getSafety5sViolationSummary } from "@/server/safety-5s-violations";
import { getWorkInjuryDeductionSummary } from "@/server/work-injury-deductions";
import { listInventoryItemsWithStock, isLowStock, localizeInventoryItem } from "@/server/inventory";
import { getRecordsDashboardData } from "@/server/records";
import { DonutChart } from "@/components/charts/donut-chart";
import { ZoneStatusBarChart } from "@/components/charts/zone-status-bar-chart";
import type { ChartDatum } from "@/components/charts/chart-utils";
import { TrendLineChart } from "@/components/charts/trend-line-chart";
import { HorizontalScroll } from "@/components/ui/horizontal-scroll";
import { KpiCard, KPI_CARD_WIDTH_CLASS } from "@/components/ui/kpi-card";

function hasPermission(permissionKeys: string[] | null, key: string) {
  return permissionKeys === null || permissionKeys.includes(key);
}

export default async function DashboardPage() {
  const ctx = await requireApiAccess(null);
  const locale = await getLocale();
  const permissionKeys = ctx.isPlatformAdmin ? null : Array.from(await getPermissionKeysForUserInOrg(ctx.userId, ctx.organizationId));

  const canSeeIncidents = hasPermission(permissionKeys, PERMISSIONS.INCIDENT_VIEW);
  const canSeeCapa = hasPermission(permissionKeys, PERMISSIONS.CAPA_VIEW);
  const canSeeViolations = hasPermission(permissionKeys, PERMISSIONS.VIOLATION_VIEW);
  const canSeeEmployees = hasPermission(permissionKeys, PERMISSIONS.EMPLOYEE_VIEW);
  const canSeeRecords = hasPermission(permissionKeys, PERMISSIONS.RECORDS_VIEW);
  const canSeeInventory = hasPermission(permissionKeys, PERMISSIONS.INVENTORY_VIEW);
  const canSeeWorkplan = hasPermission(permissionKeys, PERMISSIONS.WORKPLAN_VIEW);

  const now = new Date();

  const [org, incidentDashboard, latestIncident, capaSummary, violationsThisMonth] = await Promise.all([
    prisma.organization.findUnique({ where: { id: ctx.organizationId }, select: { name: true } }),
    canSeeIncidents ? getIncidentDashboardData(ctx.organizationId) : null,
    canSeeIncidents
      ? prisma.incident.findFirst({
          where: { organizationId: ctx.organizationId },
          orderBy: { occurredAt: "desc" },
          select: { id: true, incidentNumber: true, occurredAt: true },
        })
      : null,
    canSeeCapa ? getCapaSummary(ctx.organizationId) : null,
    canSeeViolations ? listViolations(ctx.organizationId, { year: now.getFullYear(), month: now.getMonth() + 1 }) : [],
  ]);

  const [safety5sSummary, lienDeSummary] = await Promise.all([
    canSeeViolations ? getSafety5sViolationSummary(ctx.organizationId, { year: now.getFullYear(), month: now.getMonth() + 1 }) : null,
    canSeeViolations ? getWorkInjuryDeductionSummary(ctx.organizationId, { year: now.getFullYear(), month: now.getMonth() + 1 }) : null,
  ]);

  const [employeesCount, pcccCount, recordsDashboard, severities, inventoryItems] = await Promise.all([
    canSeeEmployees ? prisma.employee.count({ where: { organizationId: ctx.organizationId, status: "active" } }) : 0,
    canSeeRecords ? prisma.recordEntry.count({ where: { organizationId: ctx.organizationId, notApplicable: false } }) : 0,
    canSeeRecords ? getRecordsDashboardData(ctx.organizationId, "PCCC") : null,
    canSeeIncidents
      ? prisma.incidentSeverity.findMany({ where: { organizationId: ctx.organizationId, isActive: true }, select: { name: true, colorHex: true } })
      : [],
    canSeeInventory ? listInventoryItemsWithStock(ctx.organizationId) : [],
  ]);

  const lowStockItems = inventoryItems.filter(isLowStock).map((item) => localizeInventoryItem(item, locale));

  const orgName = org?.name ?? t(locale, "common.appName");
  const severityColorByName = Object.fromEntries(severities.filter((s) => s.colorHex).map((s) => [s.name, s.colorHex as string]));

  // Same "Theo loại vi phạm" breakdown as the Violations module's own overview page (5S vs An
  // toàn viên vs Liên đới) — not a breakdown of the internal violationType catalog, which is a
  // different, narrower thing this card used to show by mistake.
  const violationsByTypeChart: ChartDatum[] = [
    { key: t(locale, "nav.violations5s"), value: safety5sSummary?.count ?? 0 },
    { key: t(locale, "nav.violationsInternal"), value: violationsThisMonth.length },
    { key: t(locale, "nav.violationsLienDe"), value: lienDeSummary?.count ?? 0 },
  ].filter((d) => d.value > 0);
  const violationsByTypeColorMap: Record<string, string> = {
    [t(locale, "nav.violations5s")]: "#fb923c",
    [t(locale, "nav.violationsInternal")]: "#f87171",
    [t(locale, "nav.violationsLienDe")]: "#60a5fa",
  };
  const latestViolation = violationsThisMonth.at(-1);

  // ── 5 KPI cards — every number traced to a real query above, none invented. ──
  type Kpi = { titleKey: DictionaryKey; value: string; icon: typeof AlertTriangle; bg: string; fg: string; href: string; visible: boolean };
  const allKpis: Kpi[] = [
    {
      titleKey: "dashboard.kpi.totalIncidents",
      value: String(incidentDashboard?.totalIncidents ?? 0),
      icon: AlertTriangle,
      bg: "#fef3c7",
      fg: "#d97706",
      href: "/incidents",
      visible: canSeeIncidents,
    },
    {
      titleKey: "dashboard.kpi.capaCompletionRate",
      value: capaSummary && capaSummary.total > 0 ? `${Math.round((capaSummary.completed / capaSummary.total) * 100)}%` : "—",
      icon: ClipboardCheck,
      bg: "#dcfce7",
      fg: "#16a34a",
      href: "/capa",
      visible: canSeeCapa,
    },
    {
      titleKey: "dashboard.kpi.violationsThisMonth",
      value: String(violationsThisMonth.length),
      icon: ShieldX,
      bg: "#ffedd5",
      fg: "#ea580c",
      href: "/violations/internal",
      visible: canSeeViolations,
    },
    {
      titleKey: "nav.employees",
      value: String(employeesCount),
      icon: IdCard,
      bg: "#dbeafe",
      fg: "#2563eb",
      href: "/employees",
      visible: canSeeEmployees,
    },
    {
      titleKey: "nav.recordsPccc",
      value: String(pcccCount),
      icon: FileCheck2,
      bg: "#ccfbf1",
      fg: "#0d9488",
      href: "/records/pccc",
      visible: canSeeRecords,
    },
  ];
  type QuickLink = { labelKey: DictionaryKey; href: string; icon: typeof AlertTriangle; visible: boolean };
  const allQuickLinks: QuickLink[] = [
    { labelKey: "nav.incidents", href: "/incidents", icon: AlertTriangle, visible: canSeeIncidents },
    { labelKey: "nav.inventory", href: "/inventory", icon: Warehouse, visible: canSeeInventory },
    { labelKey: "nav.violationsInternal", href: "/violations/internal", icon: ShieldX, visible: canSeeViolations },
    { labelKey: "nav.employees", href: "/employees", icon: IdCard, visible: canSeeEmployees },
    { labelKey: "nav.workPlan", href: "/planning", icon: ListTodo, visible: canSeeWorkplan },
    { labelKey: "nav.recordsPccc", href: "/records/pccc", icon: FileCheck2, visible: canSeeRecords },
  ];
  const quickLinks = allQuickLinks.filter((l) => l.visible);

  const activity: { icon: typeof AlertTriangle; text: string; sub: string; href: string }[] = [];
  if (latestIncident) {
    activity.push({
      icon: AlertTriangle,
      text: t(locale, "dashboard.activity.newIncident"),
      sub: `${latestIncident.incidentNumber} · ${new Date(latestIncident.occurredAt).toLocaleDateString()}`,
      href: `/incidents/${latestIncident.id}`,
    });
  }
  if (capaSummary && capaSummary.overdue > 0) {
    activity.push({
      icon: ClipboardCheck,
      text: t(locale, "dashboard.activity.capaOverdue", { count: capaSummary.overdue }),
      sub: t(locale, "dashboard.activity.viewCapa"),
      href: "/capa",
    });
  }
  if (latestViolation) {
    activity.push({
      icon: ShieldX,
      text: t(locale, "dashboard.activity.newViolation"),
      sub: new Date(latestViolation.occurredAt).toLocaleDateString(),
      href: "/violations/internal",
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Compact enterprise page header — no decorative banner, KPI cards start immediately. */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">
          <T k="dashboard.title" />
        </h1>
        <p className="hidden text-sm text-muted-foreground md:block">
          {orgName} · <T k="dashboard.subtitle" />
        </p>
      </div>

      {/* 5 KPI cards — always all 5, in a fixed layout, all the same size (no "hero" card —
          differing sizes read as inconsistent). A module the account can't view still keeps
          its slot (no ragged gaps in the grid) but shows a locked placeholder instead of a
          real number. */}
      <HorizontalScroll className="flex gap-3 md:grid md:grid-cols-3 lg:grid-cols-5">
        {allKpis.map((kpi) => {
          const locked = !kpi.visible;
          return (
            <Link key={kpi.href + kpi.titleKey} href={kpi.href} className={KPI_CARD_WIDTH_CLASS}>
              <KpiCard
                labelKey={kpi.titleKey}
                value={kpi.value}
                icon={kpi.icon}
                iconBg={kpi.bg}
                iconFg={kpi.fg}
                locked={locked}
                className="h-full transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
              />
            </Link>
          );
        })}
      </HorizontalScroll>

      {/* Trend + severity donut + recent activity — always 3 equal columns, even when the
          account can't see incidents (a locked placeholder fills the slot instead of the row
          disappearing and leaving a gap). The donut's legend (name + bar + count + %) needs a
          real minimum width, so stealing space from it for a wider trend chart clips its text. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {canSeeIncidents && incidentDashboard ? (
          <TrendLineChart
            titleKey="dashboard.chart.incidentTrend"
            data={incidentDashboard.incidentTrendByMonth.map((m) => ({ month: m.month, value: m.count }))}
            metric="count"
          />
        ) : (
          <LockedCard titleKey="dashboard.chart.incidentTrend" />
        )}
        {canSeeIncidents && incidentDashboard ? (
          <DonutChart titleKey="dashboard.chart.bySeverity" data={incidentDashboard.bySeverity} topN={6} colorMap={severityColorByName} />
        ) : (
          <LockedCard titleKey="dashboard.chart.bySeverity" />
        )}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">
              <T k="dashboard.activity.title" />
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            {activity.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                <T k="dashboard.activity.empty" />
              </p>
            ) : (
              activity.map((a, i) => {
                const Icon = a.icon;
                return (
                  <Link key={i} href={a.href} className="flex items-start gap-2.5 rounded-md p-1.5 text-sm hover:bg-muted">
                    <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{a.text}</p>
                      <p className="truncate text-xs text-muted-foreground">{a.sub}</p>
                    </div>
                  </Link>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Same 3-column rhythm as the row above: "Theo loại vi phạm" (col 1), PCCC records by khu
          (col 2), low-stock alert (col 3, directly under "Hoạt động gần đây"). */}
      {(canSeeViolations || canSeeRecords || (canSeeInventory && lowStockItems.length > 0)) && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {canSeeViolations ? (
            violationsByTypeChart.length > 0 ? (
              <DonutChart titleKey="violations.overview.chart.byType" data={violationsByTypeChart} topN={3} colorMap={violationsByTypeColorMap} />
            ) : (
              <div />
            )
          ) : (
            <LockedCard titleKey="violations.overview.chart.byType" />
          )}
          {canSeeRecords ? (
            recordsDashboard && recordsDashboard.byZoneStatus.length > 0 ? (
              <ZoneStatusBarChart titleKey="records.chart.byZoneStatus" data={recordsDashboard.byZoneStatus} className="h-full" chartHeight={280} />
            ) : (
              <div />
            )
          ) : (
            <LockedCard titleKey="records.chart.byZoneStatus" />
          )}
          {canSeeInventory && lowStockItems.length > 0 ? (
            <Card className="h-full border-destructive/30">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base font-semibold text-destructive">
                  <PackageX className="size-4.5" />
                  <T k="dashboard.card.lowStock" vars={{ n: lowStockItems.length }} />
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Two columns of tiles with a real-size photo each — a single narrow list left the
                    row mostly empty space between a tiny thumbnail and the number. */}
                <div className="grid max-h-[340px] grid-cols-2 gap-2 overflow-y-auto">
                  {lowStockItems.map((item) => (
                    <Link
                      key={item.id}
                      href="/inventory"
                      className="flex items-center gap-2.5 rounded-lg border border-destructive/20 bg-destructive/5 p-2 transition-colors hover:bg-destructive/10"
                    >
                      <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/60 bg-white">
                        {item.imageUrl && <Image src={item.imageUrl} alt={item.name} width={56} height={56} className="h-full w-full object-contain" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-xs leading-snug font-medium">{item.name}</p>
                        <p className={`mt-0.5 text-base leading-none font-bold ${item.stock === 0 ? "text-destructive" : "text-warning"}`}>
                          {item.stock}
                          <span className="text-xs font-medium text-muted-foreground">/{item.minStockLevel}</span>
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div />
          )}
        </div>
      )}

      {/* Quick links to real routes only */}
      {quickLinks.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 text-center transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5 hover:shadow-md"
              >
                <Icon className="size-5 text-primary" />
                <span className="text-xs font-medium">{t(locale, link.labelKey)}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Fills a chart/stat-card slot when the signed-in account lacks the view permission for it —
 *  keeps the dashboard's grid fully populated (no ragged gaps from a missing card) while still
 *  making clear the number/chart is withheld, not just empty. */
function LockedCard({ titleKey }: { titleKey: DictionaryKey }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-muted-foreground">
          <T k={titleKey} />
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center gap-2.5 py-8 text-center">
        <span className="flex size-11 items-center justify-center rounded-full bg-warning/15 text-warning">
          <Lock className="size-5.5" />
        </span>
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-semibold text-foreground">
            <T k="common.noPermissionTitle" />
          </p>
          <p className="text-xs text-muted-foreground">
            <T k="common.noPermissionDescription" />
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
