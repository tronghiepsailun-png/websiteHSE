import Link from "next/link";
import {
  AlertTriangle,
  IdCard,
  FileCheck2,
  ClipboardCheck,
  ShieldX,
  Warehouse,
  ListTodo,
  Lock,
} from "lucide-react";
import { requireApiAccess } from "@/server/api-guard";
import { PERMISSIONS } from "@/server/permissions";
import { getPermissionKeysForUserInOrg } from "@/server/rbac";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { T } from "@/components/i18n/t";
import { t } from "@/lib/i18n/translate";
import { getLocale } from "@/lib/i18n/get-locale.server";
import type { DictionaryKey } from "@/lib/i18n/translate";
import { getIncidentDashboardData } from "@/server/incidents";
import { getCapaSummary } from "@/server/capa";
import { listViolations } from "@/server/violations";
import { getAttendanceMonth, getAttendanceStats } from "@/server/attendance";
import { DonutChart } from "@/components/charts/donut-chart";
import { TrendLineChart } from "@/components/charts/trend-line-chart";

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

  const [attendanceMonth, employeesCount, pcccCount, recentPhotos, severities] = await Promise.all([
    canSeeEmployees ? getAttendanceMonth(ctx.organizationId, now.getFullYear(), now.getMonth() + 1) : null,
    canSeeEmployees ? prisma.employee.count({ where: { organizationId: ctx.organizationId, status: "active" } }) : 0,
    canSeeRecords ? prisma.recordEntry.count({ where: { organizationId: ctx.organizationId, notApplicable: false } }) : 0,
    canSeeIncidents
      ? prisma.document.findMany({
          where: { organizationId: ctx.organizationId, module: "incident", fileType: { startsWith: "image/" } },
          orderBy: { uploadedAt: "desc" },
          take: 8,
          select: { id: true, fileName: true, recordId: true },
        })
      : [],
    canSeeIncidents
      ? prisma.incidentSeverity.findMany({ where: { organizationId: ctx.organizationId, isActive: true }, select: { name: true, colorHex: true } })
      : [],
  ]);

  const orgName = org?.name ?? t(locale, "common.appName");
  const severityColorByName = Object.fromEntries(severities.filter((s) => s.colorHex).map((s) => [s.name, s.colorHex as string]));
  const attendanceStats = attendanceMonth ? getAttendanceStats(attendanceMonth.rows) : null;

  const violationsByType = Object.entries(
    violationsThisMonth.reduce<Record<string, number>>((acc, v) => {
      const name = (locale === "zh" ? v.violationType?.labelZh : v.violationType?.labelVi) ?? v.violationType?.labelVi ?? "—";
      acc[name] = (acc[name] ?? 0) + 1;
      return acc;
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
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
        <p className="text-sm text-muted-foreground">
          {orgName} · <T k="dashboard.subtitle" />
        </p>
      </div>

      {/* 5 KPI cards — always all 5, in a fixed layout. A module the account can't view still
          keeps its slot (no ragged gaps in the grid) but shows a locked placeholder instead of
          a real number. The first (highest-priority) metric gets a slightly bolder treatment
          (bigger icon/number, accent ring) so it reads as the anchor stat. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {allKpis.map((kpi, i) => {
          const Icon = kpi.icon;
          const isHero = i === 0;
          const locked = !kpi.visible;
          return (
            <Link key={kpi.href + kpi.titleKey} href={kpi.href}>
              <Card
                size="sm"
                className={cn(
                  "h-full transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg",
                  isHero && !locked && "ring-1 ring-primary/25"
                )}
              >
                <CardContent className="flex flex-row items-center gap-3">
                  <span
                    className={cn(
                      "flex shrink-0 items-center justify-center rounded-lg",
                      isHero ? "size-10" : "size-9",
                      locked && "bg-muted text-muted-foreground"
                    )}
                    style={locked ? undefined : { backgroundColor: kpi.bg, color: kpi.fg }}
                  >
                    {locked ? (
                      <Lock className={isHero ? "size-5" : "size-4.5"} />
                    ) : (
                      <Icon className={isHero ? "size-5" : "size-4.5"} />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs text-muted-foreground">{t(locale, kpi.titleKey)}</p>
                    {locked ? (
                      <p className="truncate text-xs text-muted-foreground/70">
                        <T k="common.noPermissionTitle" />
                      </p>
                    ) : (
                      <p className={cn("leading-tight font-bold", isHero ? "text-2xl" : "text-xl")}>{kpi.value}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

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

      {/* 3 small real-data cards — CAPA / Violations / Attendance (Risk, Environment,
          Training are intentionally omitted: no real data model backs them yet). Always all 3
          slots; a locked placeholder fills in for whichever the account can't view. */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {canSeeCapa && capaSummary ? (
          <Card className="transition-shadow duration-200 hover:shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">
                <T k="dashboard.card.capa" />
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <Row labelKey="status.capa.completed" value={capaSummary.completed} tone="text-success" />
              <Row labelKey="status.capa.in_progress" value={capaSummary.open - capaSummary.overdue} tone="text-foreground" />
              <Row labelKey="status.capa.overdue" value={capaSummary.overdue} tone="text-destructive" />
            </CardContent>
          </Card>
        ) : (
          <LockedCard titleKey="dashboard.card.capa" />
        )}
        {canSeeViolations ? (
          <Card className="transition-shadow duration-200 hover:shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">
                <T k="dashboard.card.violations" />
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <p className="text-2xl font-bold">{violationsThisMonth.length}</p>
              {violationsByType.map(([name, count]) => (
                <div key={name} className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="truncate">{name}</span>
                  <span className="font-medium text-foreground">{count}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : (
          <LockedCard titleKey="dashboard.card.violations" />
        )}
        {canSeeEmployees && attendanceStats ? (
          <Card className="transition-shadow duration-200 hover:shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">
                <T k="dashboard.card.attendance" />
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <Row labelKey="attendance.legend.day" value={attendanceStats.day} tone="text-foreground" />
              <Row labelKey="attendance.legend.night" value={attendanceStats.night} tone="text-foreground" />
              <Row labelKey="attendance.kpi.off" value={attendanceStats.off} tone="text-muted-foreground" />
            </CardContent>
          </Card>
        ) : (
          <LockedCard titleKey="dashboard.card.attendance" />
        )}
      </div>

      {/* Recent incident photos — real Documents, hidden entirely if none exist */}
      {recentPhotos.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">
              <T k="dashboard.recentPhotos" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {recentPhotos.map((doc) => (
                <Link key={doc.id} href={`/incidents/${doc.recordId}`} className="block shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element -- served from our own /api/documents route, not an optimizable static asset */}
                  <img
                    src={`/api/documents/${doc.id}`}
                    alt={doc.fileName}
                    className="size-24 rounded-lg border border-border object-cover"
                  />
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
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

function Row({ labelKey, value, tone }: { labelKey: DictionaryKey; value: number; tone: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">
        <T k={labelKey} />
      </span>
      <span className={`font-semibold ${tone}`}>{value}</span>
    </div>
  );
}
