import Link from "next/link";
import { ClipboardCheck, CheckCircle2, RefreshCw, Clock, AlertTriangle, FileCheck2 } from "lucide-react";
import { tryApiAccess } from "@/server/api-guard";
import { NoPermissionState } from "@/components/no-permission-state";
import { PERMISSIONS } from "@/server/permissions";
import { getRecordsDashboardData, localizeRecordType } from "@/server/records";
import { getLocale } from "@/lib/i18n/get-locale.server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { TopNBarChart } from "@/components/charts/top-n-bar-chart";
import { EmptyState } from "@/components/ui/empty-state";
import { T } from "@/components/i18n/t";
import type { DictionaryKey } from "@/lib/i18n/translate";
import { STATUS_TILE_CLASS, STATUS_TEXT_CLASS } from "@/lib/status-tone";

export default async function RecordsPcccDashboardPage() {
  const access = await tryApiAccess(PERMISSIONS.RECORDS_VIEW);
  if ("denied" in access) return <NoPermissionState />;
  const ctx = access;
  const locale = await getLocale();
  const data = await getRecordsDashboardData(ctx.organizationId, "PCCC", locale);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600">
              <FileCheck2 className="size-5" />
            </span>
            <div>
              <h1 className="text-xl font-semibold">
                <T k="records.moduleName" />
              </h1>
              <p className="text-sm text-muted-foreground">
                <T k="records.pageSubtitle" />
              </p>
            </div>
          </div>
          <Link href="/records/pccc/list" className={buttonVariants({ variant: "outline" })}>
            <T k="records.viewList" />
          </Link>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard labelKey="records.kpi.totalTracked" value={data.totalTracked} icon={ClipboardCheck} tone="neutral" />
        <KpiCard labelKey="records.kpi.sufficient" value={data.sufficientTotal} icon={CheckCircle2} tone="success" />
        <KpiCard labelKey="records.kpi.needsUpdate" value={data.needsUpdateTotal} icon={RefreshCw} tone="warning" />
        <KpiCard labelKey="records.kpi.expiringSoon" value={data.expiringSoonTotal} icon={Clock} tone="warning" />
        <KpiCard labelKey="records.kpi.expired" value={data.expiredTotal} icon={AlertTriangle} tone="critical" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TopNBarChart titleKey="records.chart.byZone" data={data.byZone} topN={10} />
        <TopNBarChart titleKey="records.chart.byGroup" data={data.byGroup} topN={10} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            <T k="records.chart.warningTable" />
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow className="h-11">
                <TableHead><T k="records.table.code" /></TableHead>
                <TableHead><T k="records.table.name" /></TableHead>
                <TableHead><T k="records.table.zone" /></TableHead>
                <TableHead><T k="records.table.expiresAt" /></TableHead>
                <TableHead className="text-right"><T k="records.filter.expiryStatus" /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.warningList.slice(0, 15).map((e) => {
                const recordType = localizeRecordType(e.recordType, locale);
                return (
                <TableRow key={e.id} className="h-14">
                  <TableCell className="py-3 font-medium">
                    <Link href={`/records/pccc/${e.id}`} className="text-primary hover:underline">
                      {recordType.code}
                    </Link>
                  </TableCell>
                  <TableCell className="py-3">{recordType.name}</TableCell>
                  <TableCell className="py-3">{e.orgUnit.name}</TableCell>
                  <TableCell className="py-3">{e.currentExpiresAt ? new Date(e.currentExpiresAt).toLocaleDateString() : "—"}</TableCell>
                  <TableCell className="py-3 text-right">
                    <span className={`font-medium ${e.expiryStatus === "expired" ? STATUS_TEXT_CLASS.critical : STATUS_TEXT_CLASS.warning}`}>
                      {e.daysUntilExpiry != null && e.daysUntilExpiry < 0 ? (
                        <T k="records.chart.daysOverdue" vars={{ n: Math.abs(e.daysUntilExpiry) }} />
                      ) : (
                        <T k="records.chart.daysLeft" vars={{ n: e.daysUntilExpiry ?? 0 }} />
                      )}
                    </span>
                  </TableCell>
                </TableRow>
                );
              })}
              {data.warningList.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5}>
                    <EmptyState message={<T k="records.chart.warningTableEmpty" />} />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({
  labelKey,
  value,
  icon: Icon,
  tone,
}: {
  labelKey: DictionaryKey;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone: keyof typeof STATUS_TILE_CLASS;
}) {
  const t = STATUS_TILE_CLASS[tone];
  return (
    <Card className={t.border}>
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
        <div>
          <CardDescription className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            <T k={labelKey} />
          </CardDescription>
          <CardTitle className="text-2xl leading-none font-bold">{value}</CardTitle>
        </div>
        <div className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${t.iconBg} ${t.iconFg}`}>
          <Icon className="size-4" />
        </div>
      </CardHeader>
    </Card>
  );
}
