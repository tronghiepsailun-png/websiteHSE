import { Fragment } from "react";
import { cn } from "@/lib/utils";
import { tryApiAccess } from "@/server/api-guard";
import { NoPermissionState } from "@/components/no-permission-state";
import { PERMISSIONS } from "@/server/permissions";
import { prisma } from "@/lib/prisma";
import {
  listWorkPlanDocuments,
  listWorkPlanItems,
  getWorkPlanStats,
  isWorkPlanItemOverdue,
  getWorkPlanDaysRemaining,
  groupByPhase,
  type WorkPlanStatus,
} from "@/server/work-plan";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { DocumentToolbar } from "./document-toolbar";
import { NewDocumentPrompt } from "./new-document-prompt";
import { WorkPlanStatusBadge } from "./work-plan-status-badge";
import { ProgressBar } from "./progress-bar";
import { InlineProgressPicker } from "./inline-progress-picker";
import { WorkPlanItemDialog } from "./work-plan-item-dialog";
import { DeleteWorkPlanButton } from "./delete-work-plan-button";
import { ResizableTableProvider, ResizableColGroup, ResizableTh } from "./resizable-columns";
import { WorkPlanBoard } from "./work-plan-board";
import { ViewModeTabs } from "@/components/ui/view-mode-tabs";
import { REPORT_GRID_CLASS } from "@/lib/table-grid";
import { T } from "@/components/i18n/t";
import { t } from "@/lib/i18n/translate";
import { getLocale } from "@/lib/i18n/get-locale.server";
import { isMobileDevice } from "@/lib/device";

function hasPermission(permissionKeys: string[] | null, key: string) {
  return permissionKeys === null || permissionKeys.includes(key);
}

// Built manually rather than via toLocaleDateString — vi-VN's day/month-only format uses "-"
// as its own separator, which then reads as indistinguishable from the " - " joining the
// start/end range (e.g. "01-09 - 30-09" looks like one confusing dash-separated string).
function fmtDate(d: Date | null) {
  if (!d) return null;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Alternating banner tints for each phase group, purely for visual separation — the color
// carries no status meaning (unlike WorkPlanStatusBadge), so it just cycles by group index.
const PHASE_BANNER_CLASS = [
  "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  "bg-purple-500/10 text-purple-700 dark:text-purple-300",
  "bg-teal-500/10 text-teal-700 dark:text-teal-300",
];

export default async function PlanningPage({ searchParams }: PageProps<"/planning">) {
  const access = await tryApiAccess(PERMISSIONS.WORKPLAN_VIEW);
  if ("denied" in access) return <NoPermissionState />;
  const ctx = access;
  const locale = await getLocale();
  const params = await searchParams;
  const mobile = await isMobileDevice();

  const [documents, permissionKeys] = await Promise.all([
    listWorkPlanDocuments(ctx.organizationId),
    ctx.isPlatformAdmin
      ? Promise.resolve(null)
      : prisma.userOrganizationRole
          .findMany({ where: { userId: ctx.userId, organizationId: ctx.organizationId }, include: { role: { include: { rolePermissions: { include: { permission: true } } } } } })
          .then((rows) => rows.flatMap((r) => r.role.rolePermissions.map((rp) => rp.permission.key))),
  ]);

  const canEdit = hasPermission(permissionKeys, PERMISSIONS.WORKPLAN_EDIT);
  const canDelete = hasPermission(permissionKeys, PERMISSIONS.WORKPLAN_DELETE);
  // Kanban's drag-and-drop doesn't translate to touch, and the phone shell has no room for a
  // view-mode toggle anyway — mobile always gets the table, regardless of a stray ?view=board.
  const view = !mobile && params.view === "board" ? "board" : "table";
  const showActionsColumn = canEdit || canDelete;
  const requestedId = typeof params.doc === "string" ? params.doc : undefined;
  const current = documents.find((d) => d.id === requestedId) ?? documents[0];

  if (!current) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold"><T k="workplan.pageTitle" /></h1>
          <p className="text-sm text-muted-foreground"><T k="workplan.pageSubtitle" /></p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <EmptyState message={<T k="workplan.noDocuments" />} action={canEdit ? <NewDocumentPrompt /> : undefined} />
          </CardContent>
        </Card>
      </div>
    );
  }

  const items = await listWorkPlanItems(current.id);
  const stats = getWorkPlanStats(items);
  const groups = groupByPhase(items);

  function daysRemainingLabel(n: number | null): string {
    if (n === null) return "—";
    if (n < 0) return t(locale, "workplan.table.daysOverdue", { n: Math.abs(n) });
    if (n === 0) return t(locale, "workplan.table.daysToday");
    return String(n);
  }

  return (
    <div className="flex flex-col gap-6">
      <DocumentToolbar current={current} documents={documents} canDelete={canDelete} />

      <div className="grid grid-cols-3 gap-3">
        <Card><CardHeader className="pb-2"><p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase"><T k="workplan.kpi.total" /></p><CardTitle className="text-2xl leading-none font-bold">{stats.total}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase"><T k="workplan.kpi.avgProgress" /></p><CardTitle className="text-2xl leading-none font-bold">{stats.avgProgress}%</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase"><T k="workplan.kpi.overdue" /></p><CardTitle className="text-2xl leading-none font-bold text-destructive">{stats.overdue}</CardTitle></CardHeader></Card>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {canEdit ? (
          <WorkPlanItemDialog documentId={current.id} phaseOptions={[...new Set(items.map((i) => i.phase).filter((p): p is string => !!p))]} />
        ) : (
          <span />
        )}
        {!mobile && <ViewModeTabs active={view} basePath="/planning" searchParams={params} locale={locale} />}
      </div>

      {view === "board" ? (
        <WorkPlanBoard
          items={items.map((item) => ({
            id: item.id,
            title: item.title,
            phase: item.phase,
            responsibleName: item.responsibleName,
            status: item.status,
            progressPercent: item.progressPercent,
            timeRange: [fmtDate(item.startDate), fmtDate(item.endDate)].filter(Boolean).join(" - ") || null,
            overdue: isWorkPlanItemOverdue(item),
          }))}
          canEdit={canEdit}
        />
      ) : (
      <Card>
        <CardContent className="pt-6">
          <ResizableTableProvider
            storageKey="workplan-table-column-widths"
            defaultWidths={{
              title: 300,
              responsible: 140,
              expectedTime: 130,
              daysRemaining: 90,
              status: 110,
              progress: 280,
              actions: 90,
            }}
          >
          <Table className={cn(REPORT_GRID_CLASS, "table-fixed")}>
            <ResizableColGroup
              order={["title", "responsible", "expectedTime", "daysRemaining", "status", "progress", ...(showActionsColumn ? ["actions"] : [])]}
            />
            <TableHeader>
              <TableRow className="h-11">
                <ResizableTh columnKey="title"><T k="workplan.table.title" /></ResizableTh>
                <ResizableTh columnKey="responsible"><T k="workplan.table.responsible" /></ResizableTh>
                <ResizableTh columnKey="expectedTime"><T k="workplan.table.expectedTime" /></ResizableTh>
                <ResizableTh columnKey="daysRemaining" className="whitespace-normal"><T k="workplan.table.daysRemaining" /></ResizableTh>
                <ResizableTh columnKey="status"><T k="common.status" /></ResizableTh>
                <ResizableTh columnKey="progress"><T k="workplan.table.progress" /></ResizableTh>
                {showActionsColumn && <ResizableTh columnKey="actions" resizable={false} className="text-right"><T k="workplan.table.actions" /></ResizableTh>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((group, gi) => (
                <Fragment key={gi}>
                  {group.phase && (
                    <TableRow key={`phase-${gi}`} className="h-9">
                      <TableCell colSpan={showActionsColumn ? 7 : 6} className={cn("py-2 text-sm font-semibold", PHASE_BANNER_CLASS[gi % PHASE_BANNER_CLASS.length])}>
                        {group.phase}
                      </TableCell>
                    </TableRow>
                  )}
                  {group.items.map((item) => {
                    const overdue = isWorkPlanItemOverdue(item);
                    const timeRange = [fmtDate(item.startDate), fmtDate(item.endDate)].filter(Boolean).join(" - ");
                    const daysRemaining = getWorkPlanDaysRemaining(item);
                    return (
                      <TableRow key={item.id} className="h-14">
                        <TableCell className="py-3 pl-6 font-medium">{item.title}</TableCell>
                        <TableCell className="py-3 text-muted-foreground">{item.responsibleName ?? "—"}</TableCell>
                        <TableCell className={cn("py-3 whitespace-nowrap", overdue && "text-destructive")}>{timeRange || "—"}</TableCell>
                        <TableCell className={cn("py-3 whitespace-nowrap", (daysRemaining ?? 0) < 0 && "font-medium text-destructive")}>
                          {daysRemainingLabel(daysRemaining)}
                        </TableCell>
                        <TableCell className="py-3"><WorkPlanStatusBadge status={item.status as WorkPlanStatus} locale={locale} /></TableCell>
                        <TableCell className="py-3">
                          {canEdit ? (
                            <InlineProgressPicker id={item.id} percent={item.progressPercent} notes={item.notes} />
                          ) : (
                            <ProgressBar percent={item.progressPercent} />
                          )}
                        </TableCell>
                        {showActionsColumn && (
                          <TableCell className="py-3">
                            <div className="flex items-center justify-end gap-1">
                              {canEdit && (
                                <WorkPlanItemDialog
                                  documentId={current.id}
                                  phaseOptions={[...new Set(items.map((i) => i.phase).filter((p): p is string => !!p))]}
                                  item={item}
                                />
                              )}
                              {canDelete && <DeleteWorkPlanButton id={item.id} />}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </Fragment>
              ))}
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={showActionsColumn ? 7 : 6}>
                    <EmptyState message={<T k="workplan.table.noResults" />} />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          </ResizableTableProvider>
        </CardContent>
      </Card>
      )}
    </div>
  );
}
