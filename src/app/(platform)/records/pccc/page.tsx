import Link from "next/link";
import { ClipboardCheck, CheckCircle2, RefreshCw, FileX, Clock, AlertTriangle } from "lucide-react";
import { requireApiAccess } from "@/server/api-guard";
import { PERMISSIONS } from "@/server/permissions";
import { getRecordsDashboardData } from "@/server/records";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { TopNBarChart } from "@/components/charts/top-n-bar-chart";
import { GREEN_SHADES, BLUE_SHADES } from "@/components/charts/chart-utils";
import { EmptyState } from "@/components/ui/empty-state";
import { T } from "@/components/i18n/t";
import type { DictionaryKey } from "@/lib/i18n/translate";

export default async function RecordsPcccDashboardPage() {
  const ctx = await requireApiAccess(PERMISSIONS.RECORDS_VIEW);
  const data = await getRecordsDashboardData(ctx.organizationId, "PCCC");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">
            <T k="records.moduleName" />
          </h1>
          <p className="text-sm text-muted-foreground">
            <T k="records.pageSubtitle" />
          </p>
        </div>
        <Link href="/records/pccc/list" className={buttonVariants({ variant: "outline" })}>
          <T k="records.viewList" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard labelKey="records.kpi.totalTracked" value={data.totalTracked} icon={ClipboardCheck} tone="neutral" />
        <KpiCard labelKey="records.kpi.sufficient" value={data.sufficientTotal} icon={CheckCircle2} tone="green" />
        <KpiCard labelKey="records.kpi.needsUpdate" value={data.needsUpdateTotal} icon={RefreshCw} tone="amber" />
        <KpiCard labelKey="records.kpi.missing" value={data.missingTotal} icon={FileX} tone="red" />
        <KpiCard labelKey="records.kpi.expiringSoon" value={data.expiringSoonTotal} icon={Clock} tone="amber" />
        <KpiCard labelKey="records.kpi.expired" value={data.expiredTotal} icon={AlertTriangle} tone="red" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TopNBarChart titleKey="records.chart.byZone" data={data.byZone} topN={10} palette={GREEN_SHADES} />
        <TopNBarChart titleKey="records.chart.byGroup" data={data.byGroup} topN={10} palette={BLUE_SHADES} />
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
              {data.warningList.slice(0, 15).map((e) => (
                <TableRow key={e.id} className="h-14">
                  <TableCell className="py-3 font-medium">
                    <Link href={`/records/pccc/${e.id}`} className="text-primary hover:underline">
                      {e.recordType.code}
                    </Link>
                  </TableCell>
                  <TableCell className="py-3">{e.recordType.name}</TableCell>
                  <TableCell className="py-3">{e.orgUnit.name}</TableCell>
                  <TableCell className="py-3">{e.currentVersion?.expiresAt ? new Date(e.currentVersion.expiresAt).toLocaleDateString() : "—"}</TableCell>
                  <TableCell className="py-3 text-right">
                    <span className={e.expiryStatus === "expired" ? "font-medium text-destructive" : "font-medium text-amber-600 dark:text-amber-400"}>
                      {e.daysUntilExpiry != null && e.daysUntilExpiry < 0 ? (
                        <T k="records.chart.daysOverdue" vars={{ n: Math.abs(e.daysUntilExpiry) }} />
                      ) : (
                        <T k="records.chart.daysLeft" vars={{ n: e.daysUntilExpiry ?? 0 }} />
                      )}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
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

const TONE_CLASSES: Record<string, { border: string; iconBg: string; iconFg: string }> = {
  neutral: { border: "", iconBg: "bg-muted", iconFg: "text-muted-foreground" },
  green: { border: "border-green-500/20", iconBg: "bg-green-500/10", iconFg: "text-green-500" },
  amber: { border: "border-amber-500/20", iconBg: "bg-amber-500/10", iconFg: "text-amber-500" },
  red: { border: "border-destructive/20", iconBg: "bg-destructive/10", iconFg: "text-destructive" },
};

function KpiCard({
  labelKey,
  value,
  icon: Icon,
  tone,
}: {
  labelKey: DictionaryKey;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone: keyof typeof TONE_CLASSES;
}) {
  const t = TONE_CLASSES[tone];
  return (
    <Card className={t.border}>
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
        <div>
          <CardDescription className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            <T k={labelKey} />
          </CardDescription>
          <CardTitle className="text-[22px] leading-none font-bold">{value}</CardTitle>
        </div>
        <div className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${t.iconBg} ${t.iconFg}`}>
          <Icon className="size-4" />
        </div>
      </CardHeader>
    </Card>
  );
}
