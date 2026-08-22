import { Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import { requireApiAccess } from "@/server/api-guard";
import { PERMISSIONS } from "@/server/permissions";
import { prisma } from "@/lib/prisma";
import { getAttendanceMonth, getAttendanceStats, availableAttendanceMonths } from "@/server/attendance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { AttendanceMonthFilter } from "./attendance-month-filter";
import { AttendanceCell } from "./attendance-cell";
import { T } from "@/components/i18n/t";
import { t } from "@/lib/i18n/translate";
import { getLocale } from "@/lib/i18n/get-locale.server";
import { REPORT_GRID_CLASS } from "@/lib/table-grid";

const WEEKDAY_VI = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

function hasPermission(permissionKeys: string[] | null, key: string) {
  return permissionKeys === null || permissionKeys.includes(key);
}

export default async function EmployeeAttendancePage({ searchParams }: PageProps<"/employees/attendance">) {
  const ctx = await requireApiAccess(PERMISSIONS.EMPLOYEE_VIEW);
  const locale = await getLocale();
  const params = await searchParams;

  const now = new Date();
  const ymRaw = typeof params.ym === "string" ? params.ym : "";
  const [yRaw, mRaw] = ymRaw.split("-");
  const year = Number(yRaw) || now.getFullYear();
  const month = Number(mRaw) || now.getMonth() + 1;

  const [{ daysInMonth, rows }, permissionKeys] = await Promise.all([
    getAttendanceMonth(ctx.organizationId, year, month),
    ctx.isPlatformAdmin
      ? Promise.resolve(null)
      : prisma.userOrganizationRole
          .findMany({ where: { userId: ctx.userId, organizationId: ctx.organizationId }, include: { role: { include: { rolePermissions: { include: { permission: true } } } } } })
          .then((r) => r.flatMap((role) => role.role.rolePermissions.map((rp) => rp.permission.key))),
  ]);
  const stats = getAttendanceStats(rows);
  const canManage = hasPermission(permissionKeys, PERMISSIONS.EMPLOYEE_MANAGE);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold"><T k="nav.employeeAttendance" /></h1>
          <p className="text-sm text-muted-foreground"><T k="attendance.pageSubtitle" /></p>
        </div>
        <AttendanceMonthFilter year={year} month={month} options={availableAttendanceMonths()} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card><CardHeader className="pb-2"><p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase"><T k="attendance.kpi.day" /></p><CardTitle className="text-2xl leading-none font-bold text-amber-600 dark:text-amber-400">{stats.day}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase"><T k="attendance.kpi.night" /></p><CardTitle className="text-2xl leading-none font-bold text-blue-600 dark:text-blue-400">{stats.night}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase"><T k="attendance.kpi.off" /></p><CardTitle className="text-2xl leading-none font-bold text-muted-foreground">{stats.off}</CardTitle></CardHeader></Card>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="flex flex-col items-center justify-center gap-0.5 rounded-md border border-border bg-muted/40 px-1.5 py-1">
            <Sun className="h-4 w-4 text-amber-500" strokeWidth={2.25} />
            <span className="rounded-full bg-green-500 px-1.5 py-0.5 text-[9px] font-bold text-white">ON</span>
          </span>
          <T k="attendance.legend.day" />
        </span>
        <span className="flex items-center gap-1.5">
          <span className="flex flex-col items-center justify-center gap-0.5 rounded-md border border-border bg-muted/40 px-1.5 py-1">
            <Moon className="h-4 w-4 text-blue-400" strokeWidth={2.25} />
            <span className="rounded-full bg-green-500 px-1.5 py-0.5 text-[9px] font-bold text-white">ON</span>
          </span>
          <T k="attendance.legend.night" />
        </span>
        <span className="flex items-center gap-1.5">
          <T k="attendance.legend.off" />
        </span>
        <span className="flex items-center gap-1.5">
          <span className="flex h-5 w-10 items-center justify-center rounded-md border border-border bg-muted/40">
            <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-bold text-white">OFF</span>
          </span>
          <T k="attendance.legend.offOverride" />
        </span>
        {canManage && <span><T k="attendance.legend.clickHint" /></span>}
      </div>

      <Card>
        <CardContent className="overflow-x-auto pt-6">
          {rows.length === 0 ? (
            <EmptyState message={<T k="attendance.noGuards" />} />
          ) : (
            <Table className={cn(REPORT_GRID_CLASS, "table-fixed")}>
              <TableHeader>
                <TableRow className="h-14">
                  <TableHead className="sticky left-0 z-10 w-40 bg-card"><T k="attendance.table.name" /></TableHead>
                  <TableHead className="sticky left-40 z-10 w-16 bg-card"><T k="attendance.table.team" /></TableHead>
                  {Array.from({ length: daysInMonth }, (_, i) => {
                    const d = new Date(Date.UTC(year, month - 1, i + 1));
                    const isWeekend = d.getUTCDay() === 0 || d.getUTCDay() === 6;
                    return (
                      <TableHead key={i} className={cn("w-16 text-center whitespace-nowrap", isWeekend && "text-muted-foreground/60")}>
                        <div>{WEEKDAY_VI[d.getUTCDay()]}</div>
                        <div className="font-normal">{String(i + 1).padStart(2, "0")}</div>
                      </TableHead>
                    );
                  })}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ guard, cells }) => (
                  <TableRow key={guard.id} className="h-12">
                    <TableCell className="sticky left-0 z-10 bg-card font-medium whitespace-nowrap">
                      <div>{guard.fullName}</div>
                      {guard.fullNameZh && <div className="text-xs text-muted-foreground">{guard.fullNameZh}</div>}
                    </TableCell>
                    <TableCell className="sticky left-40 z-10 bg-card text-center text-muted-foreground">
                      {guard.shift ? `${t(locale, "attendance.team.prefix")} ${guard.shift}` : "—"}
                    </TableCell>
                    {cells.map((cell) => {
                      const dateStr = cell.date.toISOString().slice(0, 10);
                      return (
                        <TableCell key={dateStr} className="p-1 text-center">
                          <AttendanceCell
                            employeeId={guard.id}
                            date={dateStr}
                            status={cell.status}
                            defaultStatus={cell.defaultStatus}
                            hours={cell.hours}
                            notes={cell.notes}
                            isOverride={cell.isOverride}
                            disabled={!canManage}
                          />
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
