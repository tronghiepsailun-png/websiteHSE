"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useT } from "@/lib/i18n/locale-context";
import type { ChartDatum } from "./chart-utils";

export function ViewAllDialog({ title, rows }: { title: string; rows: ChartDatum[] }) {
  const t = useT();
  const total = rows.reduce((sum, r) => sum + r.value, 0);

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="ghost" size="sm" />}>{t("incidents.chart.viewAll")}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("incidents.chart.viewAllTitle", { title })}</DialogTitle>
        </DialogHeader>
        <div className="max-h-96 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.name")}</TableHead>
                <TableHead className="text-right">{t("incidents.chart.count")}</TableHead>
                <TableHead className="text-right">{t("incidents.chart.percent")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.key ?? "__unspecified__"}>
                  <TableCell>{r.key ?? t("incidents.chart.unspecified")}</TableCell>
                  <TableCell className="text-right font-mono">{r.value.toLocaleString("vi-VN")}</TableCell>
                  <TableCell className="text-right font-mono">{total > 0 ? ((r.value / total) * 100).toFixed(1) : "0.0"}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
