import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { T } from "@/components/i18n/t";
import { t } from "@/lib/i18n/translate";
import { getLocale } from "@/lib/i18n/get-locale.server";
import type { getSheet04DeductionData, WorkshopLite } from "@/server/incident-reports";
import { REPORT_GRID_CLASS } from "@/lib/table-grid";

function fmt(n: number | null) {
  if (n === null) return "—";
  return n.toLocaleString("vi-VN", { maximumFractionDigits: 2 });
}

function groupSpans(workshops: WorkshopLite[]) {
  const spans: number[] = new Array(workshops.length).fill(0);
  let i = 0;
  while (i < workshops.length) {
    let j = i + 1;
    while (j < workshops.length && workshops[j].groupName === workshops[i].groupName) j++;
    spans[i] = j - i;
    i = j;
  }
  return spans;
}

export async function Sheet04DeductionTable({ data }: { data: Awaited<ReturnType<typeof getSheet04DeductionData>> }) {
  const locale = await getLocale();

  if (data.rows.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <EmptyState message={<T k="incidents.report.stats.noWorkshop" />} />
        </CardContent>
      </Card>
    );
  }

  const spans = groupSpans(data.rows.map((r) => r.workshop));

  return (
    <Card>
      <CardContent className="pt-6">
        <Table className={REPORT_GRID_CLASS}>
          <TableHeader>
            <TableRow className="h-11">
              <TableHead className="sticky left-0 z-10 bg-card whitespace-nowrap">{t(locale, "admin.hseTargets.groupName")}</TableHead>
              <TableHead className="sticky left-32 z-10 bg-card whitespace-nowrap"><T k="incidents.report.score.workshopCol" /></TableHead>
              <TableHead className="text-center whitespace-nowrap"><T k="incidents.report.deduction.safetyCategory" /></TableHead>
              <TableHead className="text-center whitespace-nowrap"><T k="incidents.report.deduction.priorActual" /></TableHead>
              <TableHead className="text-center whitespace-nowrap"><T k="incidents.report.deduction.priorTarget" /></TableHead>
              <TableHead className="text-center whitespace-nowrap"><T k="incidents.report.deduction.currentTarget" /></TableHead>
              <TableHead className="text-center whitespace-nowrap"><T k="incidents.report.deduction.cumulative" /></TableHead>
              {Array.from({ length: 12 }, (_, i) => (
                <TableHead key={i} className="w-16 min-w-16 text-center whitespace-nowrap">
                  <T k="incidents.dashboard.monthLabel" vars={{ n: i + 1 }} />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map((row, i) => (
              <TableRow key={row.workshop.id} className="h-11">
                {spans[i] > 0 && (
                  <TableCell
                    rowSpan={spans[i]}
                    className="sticky left-0 z-10 bg-card align-top font-medium whitespace-nowrap text-muted-foreground"
                  >
                    {row.workshop.groupName}
                  </TableCell>
                )}
                <TableCell className="sticky left-32 z-10 bg-card font-medium whitespace-nowrap">{row.workshop.name}</TableCell>
                <TableCell className="text-center text-muted-foreground whitespace-nowrap">{row.workshop.safetyCategory ?? "—"}</TableCell>
                <TableCell className="text-center text-muted-foreground">{fmt(row.priorYearActual)}</TableCell>
                <TableCell className="text-center text-muted-foreground">{fmt(row.priorYearTarget)}</TableCell>
                <TableCell className="text-center text-muted-foreground">{fmt(row.currentYearTarget)}</TableCell>
                <TableCell className="text-center font-semibold">{fmt(row.cumulative)}</TableCell>
                {row.monthly.map((v, i) => (
                  <TableCell key={i} className="w-16 min-w-16 text-center whitespace-nowrap">
                    {v ? fmt(v) : ""}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            <TableRow className="h-11 font-semibold">
              <TableCell className="sticky left-0 z-10 bg-card" colSpan={6}>
                <T k="incidents.report.stats.totalRow" />
              </TableCell>
              <TableCell className="text-center">{fmt(data.totalRow.cumulative)}</TableCell>
              {data.totalRow.monthly.map((v, i) => (
                <TableCell key={i} className="w-16 min-w-16 text-center whitespace-nowrap">
                  {v ? fmt(v) : ""}
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
