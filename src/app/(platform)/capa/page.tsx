import Link from "next/link";
import { requireApiAccess } from "@/server/api-guard";
import { PERMISSIONS } from "@/server/permissions";
import { listCapaForOrg, getCapaSummary, isCapaOverdue } from "@/server/capa";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CapaStatusBadge } from "@/components/incidents/severity-badge";
import { CapaFilters } from "./capa-filters";
import { CapaStatusForm } from "./capa-status-form";
import { EmptyState } from "@/components/ui/empty-state";
import { TablePagination } from "@/components/ui/table-pagination";
import { T } from "@/components/i18n/t";

const LIST_PAGE_SIZE = 20;

function hasPermission(permissionKeys: string[] | null, key: string) {
  return permissionKeys === null || permissionKeys.includes(key);
}

/** The status Select submits the literal string "all" for "no filter selected" — treat that as unset. */
function parseFilterParam(value: unknown): string | undefined {
  if (typeof value !== "string" || value === "" || value === "all") return undefined;
  return value;
}

export default async function CapaPage({ searchParams }: PageProps<"/capa">) {
  const ctx = await requireApiAccess(PERMISSIONS.CAPA_VIEW);
  const params = await searchParams;
  const status = parseFilterParam(params.status);
  const search = typeof params.q === "string" && params.q !== "" ? params.q : undefined;

  const [capaItems, summary, permissionKeys] = await Promise.all([
    listCapaForOrg(ctx.organizationId, { status, search }),
    getCapaSummary(ctx.organizationId),
    ctx.isPlatformAdmin
      ? Promise.resolve(null)
      : prisma.userOrganizationRole
          .findMany({ where: { userId: ctx.userId, organizationId: ctx.organizationId }, include: { role: { include: { rolePermissions: { include: { permission: true } } } } } })
          .then((rows) => rows.flatMap((r) => r.role.rolePermissions.map((rp) => rp.permission.key))),
  ]);

  const incidentIds = capaItems.filter((c) => c.sourceModule === "incident").map((c) => c.sourceRecordId);
  const incidents = incidentIds.length
    ? await prisma.incident.findMany({ where: { id: { in: incidentIds } }, select: { id: true, incidentNumber: true } })
    : [];
  const incidentNumberById = new Map(incidents.map((i) => [i.id, i.incidentNumber]));

  const canEdit = hasPermission(permissionKeys, PERMISSIONS.CAPA_EDIT);

  // List pagination — 20 rows by default, with a "view all" escape hatch. Purely a rendering
  // slice of the already-fetched, already-filtered `capaItems` array; no new query/data logic.
  const listPage = Math.max(1, Number(params.page) || 1);
  const listViewAll = params.viewAll === "1";
  const listTotalPages = Math.max(1, Math.ceil(capaItems.length / LIST_PAGE_SIZE));
  const listPageClamped = Math.min(listPage, listTotalPages);
  const visibleCapaItems = listViewAll
    ? capaItems
    : capaItems.slice((listPageClamped - 1) * LIST_PAGE_SIZE, listPageClamped * LIST_PAGE_SIZE);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">CAPA</h1>
        <p className="text-sm text-muted-foreground"><T k="capa.pageSubtitle" /></p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card><CardHeader className="pb-2"><p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase"><T k="capa.kpi.total" /></p><CardTitle className="text-2xl leading-none font-bold">{summary.total}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase"><T k="capa.kpi.open" /></p><CardTitle className="text-2xl leading-none font-bold">{summary.open}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase"><T k="capa.kpi.overdue" /></p><CardTitle className="text-2xl leading-none font-bold text-destructive">{summary.overdue}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase"><T k="capa.kpi.completed" /></p><CardTitle className="text-2xl leading-none font-bold">{summary.completed}</CardTitle></CardHeader></Card>
      </div>

      <CapaFilters search={search} status={status} />

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow className="h-11">
                <TableHead><T k="capa.table.action" /></TableHead>
                <TableHead><T k="capa.table.source" /></TableHead>
                <TableHead><T k="capa.table.responsible" /></TableHead>
                <TableHead><T k="capa.table.due" /></TableHead>
                <TableHead><T k="common.status" /></TableHead>
                {canEdit && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleCapaItems.map((c) => {
                const overdue = isCapaOverdue(c);
                return (
                  <TableRow key={c.id} className="h-14">
                    <TableCell className="max-w-xs py-3 font-medium">{c.action}</TableCell>
                    <TableCell className="py-3">
                      {c.sourceModule === "incident" && incidentNumberById.has(c.sourceRecordId) ? (
                        <Link href={`/incidents/${c.sourceRecordId}`} className="text-primary hover:underline">
                          {incidentNumberById.get(c.sourceRecordId)}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">{c.sourceModule}</span>
                      )}
                    </TableCell>
                    <TableCell className="py-3">{c.responsiblePerson?.fullName ?? "—"}</TableCell>
                    <TableCell className={cn("py-3", overdue && "text-destructive")}>
                      {c.dueDate ? new Date(c.dueDate).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell className="py-3">
                      <CapaStatusBadge status={overdue ? "overdue" : c.status} />
                    </TableCell>
                    {canEdit && (
                      <TableCell className="py-3">
                        <CapaStatusForm capaId={c.id} status={c.status} />
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
              {capaItems.length === 0 && (
                <TableRow>
                  <TableCell colSpan={canEdit ? 6 : 5}>
                    <EmptyState message={<T k="capa.table.noResults" />} />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <TablePagination
            total={capaItems.length}
            page={listPageClamped}
            pageSize={LIST_PAGE_SIZE}
            viewAll={listViewAll}
            unitLabelKey="capa.unitLabel"
            basePath="/capa"
            searchParams={params}
          />
        </CardContent>
      </Card>
    </div>
  );
}
