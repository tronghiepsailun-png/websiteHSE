import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { T } from "@/components/i18n/t";
import { getLocale } from "@/lib/i18n/get-locale.server";
import type { getSheet02CrosstabData } from "@/server/incident-reports";
import { REPORT_GRID_CLASS } from "@/lib/table-grid";

export async function Sheet02Crosstab({ data }: { data: Awaited<ReturnType<typeof getSheet02CrosstabData>> }) {
  const locale = await getLocale();

  if (data.columns.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <EmptyState message={<T k="incidents.report.stats.noWorkshop" />} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="overflow-x-auto pt-6">
        <Table className={REPORT_GRID_CLASS}>
          <TableHeader>
            <TableRow className="h-11">
              <TableHead className="sticky left-0 z-10 bg-card whitespace-nowrap"><T k="incidents.report.stats.severityCol" /></TableHead>
              <TableHead className="min-w-56"><T k="incidents.report.stats.criteria" /></TableHead>
              {data.columns.map((c) => (
                <TableHead key={c.id} className="text-center whitespace-nowrap">
                  {c.name}
                </TableHead>
              ))}
              <TableHead className="sticky right-0 z-10 bg-card text-center whitespace-nowrap"><T k="incidents.report.stats.totalRow" /></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map((row) => (
              <TableRow key={row.severityCode} className="h-11">
                <TableCell className="sticky left-0 z-10 bg-card text-center font-medium whitespace-nowrap">
                  {row.severityCode}
                </TableCell>
                <TableCell className="max-w-xs">
                  {row.criteria ? (
                    <Tooltip>
                      <TooltipTrigger className="block max-w-xs cursor-default truncate text-left text-muted-foreground">
                        {row.criteria[locale].short}
                      </TooltipTrigger>
                      <TooltipContent className="max-w-sm text-wrap">{row.criteria[locale].full}</TooltipContent>
                    </Tooltip>
                  ) : (
                    "—"
                  )}
                </TableCell>
                {row.cells.map((v, i) => (
                  <TableCell key={data.columns[i].id} className="text-center">
                    {v || "—"}
                  </TableCell>
                ))}
                <TableCell className="sticky right-0 z-10 bg-card text-center font-semibold">{row.rowTotal}</TableCell>
              </TableRow>
            ))}
            <TableRow className="h-11 font-semibold">
              <TableCell className="sticky left-0 z-10 bg-card" colSpan={2}>
                <T k="incidents.report.stats.totalRow" />
              </TableCell>
              {data.totalsByColumn.map((v, i) => (
                <TableCell key={data.columns[i].id} className="text-center">
                  {v}
                </TableCell>
              ))}
              <TableCell className="sticky right-0 z-10 bg-card text-center">{data.grandTotal}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
