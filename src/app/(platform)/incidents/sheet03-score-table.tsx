import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { T } from "@/components/i18n/t";
import { t } from "@/lib/i18n/translate";
import { getLocale } from "@/lib/i18n/get-locale.server";
import type { getSheet03ScoreData, WorkshopLite } from "@/server/incident-reports";
import { REPORT_GRID_CLASS } from "@/lib/table-grid";

function scoreClass(delta: number) {
  if (delta > 0) return "text-foreground";
  if (delta === 0) return "text-muted-foreground";
  return "text-red-500";
}

/** Rows are already sorted by sortOrder, and the seeded workshop list groups contiguously by
 *  groupName — so a simple "does this row start a new group" scan gives the correct rowSpan
 *  for a merged-cell look, matching the source Excel's merged 部门 column. */
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

export async function Sheet03ScoreTable({ data }: { data: Awaited<ReturnType<typeof getSheet03ScoreData>> }) {
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
      <CardContent className="overflow-x-auto pt-6">
        <Table className={REPORT_GRID_CLASS}>
          <TableHeader>
            <TableRow className="h-11">
              <TableHead className="sticky left-0 z-10 bg-card whitespace-nowrap">{t(locale, "admin.hseTargets.groupName")}</TableHead>
              <TableHead className="sticky left-32 z-10 bg-card whitespace-nowrap"><T k="incidents.report.score.workshopCol" /></TableHead>
              {Array.from({ length: data.monthsComputed }, (_, i) => (
                <TableHead key={i} className="text-center whitespace-nowrap">
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
                {row.monthlyScores.map((cell, mi) => (
                  <TableCell key={mi} className={`text-center font-medium ${scoreClass(cell.delta)}`}>
                    {cell.incidents.length > 0 ? (
                      <Tooltip>
                        <TooltipTrigger className="cursor-default underline decoration-dotted underline-offset-2">
                          {cell.score}
                        </TooltipTrigger>
                        <TooltipContent className="max-w-sm text-wrap">
                          <div className="flex flex-col gap-1">
                            {cell.incidents.map((inc) => (
                              <div key={inc.id}>
                                <span className="font-semibold">
                                  {inc.severityCode} · {inc.incidentNumber}
                                </span>
                                : {inc.description}
                              </div>
                            ))}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      cell.score
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
