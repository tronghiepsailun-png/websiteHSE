import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { T } from "@/components/i18n/t";
import type { getSheet05KpiData } from "@/server/incident-reports";
import { REPORT_GRID_CLASS } from "@/lib/table-grid";

function fmt(n: number, unit: string) {
  if (unit === "%") return `${(n * 100).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%`;
  return n.toLocaleString("vi-VN", { maximumFractionDigits: 2 });
}

export function Sheet05KpiTable({ data }: { data: Awaited<ReturnType<typeof getSheet05KpiData>> }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <Table className={REPORT_GRID_CLASS}>
          <TableHeader>
            <TableRow className="h-11">
              <TableHead className="whitespace-nowrap"><T k="incidents.report.kpi.category" /></TableHead>
              <TableHead className="whitespace-nowrap"><T k="incidents.report.kpi.item" /></TableHead>
              <TableHead className="whitespace-nowrap"><T k="incidents.report.kpi.unit" /></TableHead>
              <TableHead className="text-center whitespace-nowrap"><T k="incidents.report.kpi.priorActual" /></TableHead>
              <TableHead className="text-center whitespace-nowrap"><T k="incidents.report.kpi.currentTarget" /></TableHead>
              <TableHead className="text-center whitespace-nowrap"><T k="incidents.report.kpi.currentActual" /></TableHead>
              {Array.from({ length: 12 }, (_, i) => (
                <TableHead key={i} className="text-center whitespace-nowrap">
                  <T k="incidents.dashboard.monthLabel" vars={{ n: i + 1 }} />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map((row) => (
              <TableRow key={row.code} className="h-11">
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  <div>{row.categoryZh}</div>
                  <div className="text-xs">{row.categoryVi}</div>
                </TableCell>
                <TableCell className="whitespace-nowrap font-medium">
                  <div>{row.nameZh}</div>
                  <div className="text-xs font-normal text-muted-foreground">{row.nameVi}</div>
                </TableCell>
                <TableCell className="whitespace-nowrap">{row.unit}</TableCell>
                <TableCell className="text-center text-muted-foreground">{fmt(row.priorYearActual, row.unit)}</TableCell>
                <TableCell className="text-center text-muted-foreground">
                  {row.currentYearTarget === null ? (
                    <T k="incidents.report.kpi.noTarget" />
                  ) : (
                    `${row.targetDisplayPrefix ?? ""}${fmt(row.currentYearTarget, row.unit)}`
                  )}
                </TableCell>
                <TableCell className="text-center font-semibold">{fmt(row.currentYearActual, row.unit)}</TableCell>
                {row.monthly.map((v, i) => (
                  <TableCell key={i} className="text-center">
                    {i < data.monthsElapsed ? fmt(v, row.unit) : "—"}
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
