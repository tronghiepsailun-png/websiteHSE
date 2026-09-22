import Link from "next/link";
import { AlertOctagon, ShieldX, Link2, Wallet, Download } from "lucide-react";
import { tryApiAccess } from "@/server/api-guard";
import { NoPermissionState } from "@/components/no-permission-state";
import { PERMISSIONS } from "@/server/permissions";
import { prisma } from "@/lib/prisma";
import { listViolations, availableViolationMonths } from "@/server/violations";
import { getSafety5sViolationSummary, availableSafety5sViolationMonths, listSafety5sViolations } from "@/server/safety-5s-violations";
import { getWorkInjuryDeductionSummary, availableWorkInjuryDeductionMonths, listWorkInjuryDeductions } from "@/server/work-injury-deductions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DonutChart } from "@/components/charts/donut-chart";
import { TopNBarChart } from "@/components/charts/top-n-bar-chart";
import type { ChartDatum } from "@/components/charts/chart-utils";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { buttonVariants } from "@/components/ui/button";
import { OverviewMonthFilter } from "./overview-month-filter";
import { HorizontalScroll } from "@/components/ui/horizontal-scroll";
import { T } from "@/components/i18n/t";
import { t } from "@/lib/i18n/translate";
import { getLocale } from "@/lib/i18n/get-locale.server";
import { cn } from "@/lib/utils";
import type { DictionaryKey } from "@/lib/i18n/translate";
import { KpiCard, KPI_CARD_WIDTH_CLASS } from "@/components/ui/kpi-card";

function vnd(n: number) {
  return `${n.toLocaleString("vi-VN")} đ`;
}

function hasPermission(permissionKeys: string[] | null, key: string) {
  return permissionKeys === null || permissionKeys.includes(key);
}

export default async function ViolationsOverviewPage({ searchParams }: PageProps<"/violations">) {
  const access = await tryApiAccess(PERMISSIONS.VIOLATION_VIEW);
  if ("denied" in access) return <NoPermissionState />;
  const ctx = access;
  const locale = await getLocale();
  const params = await searchParams;

  const now = new Date();
  const ymRaw = typeof params.ym === "string" ? params.ym : "";
  const [yRaw, mRaw] = ymRaw.split("-");
  const year = Number(yRaw) || now.getFullYear();
  const month = Number(mRaw) || now.getMonth() + 1;

  const [safety5s, internalRows, lienDe, safety5sRows, lienDeRows, months5s, monthsInternal, monthsLienDe, permissionKeys] = await Promise.all([
    getSafety5sViolationSummary(ctx.organizationId, { year, month }),
    listViolations(ctx.organizationId, { year, month }),
    getWorkInjuryDeductionSummary(ctx.organizationId, { year, month }),
    listSafety5sViolations(ctx.organizationId, { year, month }),
    listWorkInjuryDeductions(ctx.organizationId, { year, month }),
    availableSafety5sViolationMonths(ctx.organizationId),
    availableViolationMonths(ctx.organizationId),
    availableWorkInjuryDeductionMonths(ctx.organizationId),
    ctx.isPlatformAdmin
      ? Promise.resolve(null)
      : prisma.userOrganizationRole
          .findMany({ where: { userId: ctx.userId, organizationId: ctx.organizationId }, include: { role: { include: { rolePermissions: { include: { permission: true } } } } } })
          .then((rows) => rows.flatMap((r) => r.role.rolePermissions.map((rp) => rp.permission.key))),
  ]);

  const canDownload = hasPermission(permissionKeys, PERMISSIONS.VIOLATION_DOWNLOAD);

  // Union of every period that has real data in ANY of the 3 violation types — a month with
  // only a 5S entry (say) still needs to show up here, not just in that module's own picker.
  const monthOptions = Array.from(
    new Map([...months5s, ...monthsInternal, ...monthsLienDe].map((p) => [`${p.year}-${p.month}`, p])).values()
  ).sort((a, b) => b.year - a.year || b.month - a.month);

  const internalCount = internalRows.length;
  const internalTotalVnd = internalRows.reduce((sum, v) => sum + v.amountVnd, 0);
  const totalVnd = safety5s.totalFineVnd + internalTotalVnd + lienDe.totalFineVnd;

  // Softer than the Incidents module's palette on purpose — a logged violation isn't an
  // active safety incident, so it doesn't need the same alarm-red/orange intensity. Same hues,
  // lighter Tailwind step (400 instead of 600), kept consistent between the KPI icons and the
  // donut below so the two don't drift into different color identities for the same type.
  const kpis: { titleKey: DictionaryKey; value: string; icon: typeof AlertOctagon; bg: string; fg: string; href: string }[] = [
    { titleKey: "nav.violations5s", value: String(safety5s.count), icon: AlertOctagon, bg: "#ffedd5", fg: "#fb923c", href: "/violations/5s" },
    { titleKey: "nav.violationsInternal", value: String(internalCount), icon: ShieldX, bg: "#fee2e2", fg: "#f87171", href: "/violations/internal" },
    { titleKey: "nav.violationsLienDe", value: String(lienDe.count), icon: Link2, bg: "#dbeafe", fg: "#60a5fa", href: "/violations/lien-de" },
    { titleKey: "violations.overview.kpi.totalFine", value: vnd(totalVnd), icon: Wallet, bg: "#dcfce7", fg: "#4ade80", href: "#" },
  ];

  const byType = [
    { key: t(locale, "nav.violations5s"), value: safety5s.count },
    { key: t(locale, "nav.violationsInternal"), value: internalCount },
    { key: t(locale, "nav.violationsLienDe"), value: lienDe.count },
  ].filter((d) => d.value > 0);
  // Same color each type already wears on its own KPI card above — a shared identity per
  // violation type, not the default rank-only green ramp (which reads fine for a single
  // undifferentiated category chart, but three genuinely distinct types deserve their own hue).
  const byTypeColorMap: Record<string, string> = {
    [t(locale, "nav.violations5s")]: "#fb923c",
    [t(locale, "nav.violationsInternal")]: "#f87171",
    [t(locale, "nav.violationsLienDe")]: "#60a5fa",
  };

  // Department comparison — every one of the 3 violation types snapshots the offending
  // employee's orgUnitLevel1 at logging time, so all three roll up into one ranking regardless
  // of which module they came from.
  const departmentCounts = new Map<string, number>();
  function addDept(dept: string | null | undefined) {
    if (!dept) return;
    departmentCounts.set(dept, (departmentCounts.get(dept) ?? 0) + 1);
  }
  internalRows.forEach((v) => addDept(v.safetyOfficer.employee.orgUnitLevel1));
  safety5sRows.forEach((v) => addDept(v.orgUnitLevel1Snapshot));
  lienDeRows.forEach((v) => addDept(v.orgUnitLevel1Snapshot));
  const byDepartment: ChartDatum[] = [...departmentCounts.entries()].map(([key, value]) => ({ key, value })).sort((a, b) => b.value - a.value);

  // Violation-content ranking — only 5S (free-text violationContent) and An toàn viên (its
  // ViolationType catalog) actually describe WHAT happened; Liên đới records are a payroll
  // deduction derived from someone else's incident and carry no violation reason of their own,
  // so it has nothing to contribute here.
  function violationTypeLabel(vt: { labelVi: string; labelZh: string | null }) {
    return locale === "zh" ? (vt.labelZh ?? vt.labelVi) : vt.labelVi;
  }
  function bilingualContentLabel(text: string) {
    const parts = text.split("\n");
    if (parts.length < 2) return text;
    return locale === "zh" ? parts[0] : parts[1];
  }
  const contentCounts = new Map<string, number>();
  function addContent(text: string | null | undefined) {
    if (!text) return;
    contentCounts.set(text, (contentCounts.get(text) ?? 0) + 1);
  }
  safety5sRows.forEach((v) => addContent(bilingualContentLabel(v.violationContent)));
  internalRows.forEach((v) => addContent(violationTypeLabel(v.violationType)));
  const byContent: ChartDatum[] = [...contentCounts.entries()].map(([key, value]) => ({ key, value })).sort((a, b) => b.value - a.value);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {canDownload && (
          <DropdownMenu>
            <DropdownMenuTrigger className={buttonVariants({ variant: "outline" })}>
              <Download className="size-4" />
              <T k="violations.download.button" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem render={<a href={`/api/violations/5s/export?year=${year}&month=${month}`} />}>
                {t(locale, "nav.violations5s")}
              </DropdownMenuItem>
              <DropdownMenuItem render={<a href={`/api/violations/export?year=${year}&month=${month}`} />}>
                {t(locale, "nav.violationsInternal")}
              </DropdownMenuItem>
              <DropdownMenuItem render={<a href={`/api/violations/lien-de/export?year=${year}&month=${month}`} />}>
                {t(locale, "nav.violationsLienDe")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <OverviewMonthFilter year={year} month={month} options={monthOptions} />

      <HorizontalScroll className="flex gap-3 md:grid md:grid-cols-4">
        {kpis.map((kpi) => {
          const content = (
            <KpiCard
              labelKey={kpi.titleKey}
              value={kpi.value}
              icon={kpi.icon}
              iconBg={kpi.bg}
              iconFg={kpi.fg}
              className={cn("h-full transition-all duration-200", kpi.href !== "#" && "hover:-translate-y-0.5 hover:shadow-lg")}
            />
          );
          return kpi.href === "#" ? (
            <div key={kpi.titleKey} className={KPI_CARD_WIDTH_CLASS}>{content}</div>
          ) : (
            <Link key={kpi.titleKey} href={kpi.href} className={KPI_CARD_WIDTH_CLASS}>{content}</Link>
          );
        })}
      </HorizontalScroll>

      {byType.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <DonutChart titleKey="violations.overview.chart.byType" data={byType} topN={3} colorMap={byTypeColorMap} />
          <TopNBarChart titleKey="violations.overview.chart.byDepartment" data={byDepartment} topN={8} />
        </div>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">
              <T k="violations.overview.chart.byType" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="py-8 text-center text-sm text-muted-foreground">
              <T k="violations.overview.empty" />
            </p>
          </CardContent>
        </Card>
      )}

      {byContent.length > 0 && <TopNBarChart titleKey="violations.overview.chart.byContent" data={byContent} topN={8} labelWidth={220} />}
    </div>
  );
}
