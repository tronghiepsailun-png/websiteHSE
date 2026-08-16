import Link from "next/link";
import { requireApiAccess } from "@/server/api-guard";
import { PERMISSIONS } from "@/server/permissions";
import { listRecordEntries, type DataStatus, type ExpiryStatus } from "@/server/records";
import { listSites } from "@/server/records-catalog";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { TablePagination } from "@/components/ui/table-pagination";
import { T } from "@/components/i18n/t";
import { RecordsFilters } from "./records-filters";
import { DataStatusBadge, ExpiryStatusBadge } from "../status-badges";

const LIST_PAGE_SIZE = 20;

function parseFilterParam(value: unknown): string | undefined {
  if (typeof value !== "string" || value === "" || value === "all") return undefined;
  return value;
}

export default async function RecordsListPage({ searchParams }: PageProps<"/records/pccc/list">) {
  const ctx = await requireApiAccess(PERMISSIONS.RECORDS_VIEW);
  const params = await searchParams;

  const search = typeof params.q === "string" && params.q !== "" ? params.q : undefined;
  const orgUnitId = parseFilterParam(params.orgUnitId);
  const groupCode = parseFilterParam(params.groupCode);
  const dataStatus = parseFilterParam(params.dataStatus) as DataStatus | undefined;
  const expiryStatus = parseFilterParam(params.expiryStatus) as ExpiryStatus | undefined;
  const page = Math.max(1, Number(params.page) || 1);
  const viewAll = params.viewAll === "1";

  const [entries, zones, groups] = await Promise.all([
    listRecordEntries(ctx.organizationId, "PCCC", { search, orgUnitId, groupCode, dataStatus, expiryStatus }),
    listSites(ctx.organizationId),
    prisma.recordGroup.findMany({ where: { domain: { organizationId: ctx.organizationId, code: "PCCC" } }, orderBy: { sortOrder: "asc" } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(entries.length / LIST_PAGE_SIZE));
  const pageClamped = Math.min(page, totalPages);
  const visible = viewAll ? entries : entries.slice((pageClamped - 1) * LIST_PAGE_SIZE, pageClamped * LIST_PAGE_SIZE);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">
          <T k="records.list.title" />
        </h1>
        <p className="text-sm text-muted-foreground">
          <T k="records.moduleName" />
        </p>
      </div>

      <RecordsFilters
        search={search}
        orgUnitId={orgUnitId}
        groupCode={groupCode}
        dataStatus={dataStatus}
        expiryStatus={expiryStatus}
        zones={zones.map((z) => ({ id: z.id, name: z.name }))}
        groups={groups.map((g) => ({ id: g.code, name: `${g.code} · ${g.name}` }))}
      />

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow className="h-11">
                <TableHead><T k="records.table.code" /></TableHead>
                <TableHead><T k="records.table.name" /></TableHead>
                <TableHead><T k="records.table.zone" /></TableHead>
                <TableHead><T k="records.table.dataStatus" /></TableHead>
                <TableHead><T k="records.table.expiryStatus" /></TableHead>
                <TableHead><T k="records.table.expiresAt" /></TableHead>
                <TableHead><T k="records.table.responsiblePerson" /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((e) => (
                <TableRow key={e.id} className="h-14">
                  <TableCell className="py-3 font-medium">
                    <Link href={`/records/pccc/${e.id}`} className="text-primary hover:underline">
                      {e.recordType.code}
                    </Link>
                  </TableCell>
                  <TableCell className="py-3">{e.recordType.name}</TableCell>
                  <TableCell className="py-3">{e.orgUnit.name}</TableCell>
                  <TableCell className="py-3">
                    <DataStatusBadge status={e.dataStatus} />
                  </TableCell>
                  <TableCell className="py-3">
                    <ExpiryStatusBadge status={e.expiryStatus} />
                  </TableCell>
                  <TableCell className="py-3">
                    {e.currentVersion?.expiresAt ? new Date(e.currentVersion.expiresAt).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell className="py-3">{e.responsiblePerson ?? "—"}</TableCell>
                </TableRow>
              ))}
              {visible.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7}>
                    <EmptyState message={<T k="records.table.noResults" />} />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <TablePagination
            total={entries.length}
            page={pageClamped}
            pageSize={LIST_PAGE_SIZE}
            viewAll={viewAll}
            unitLabelKey="records.unitLabel"
            basePath="/records/pccc/list"
            searchParams={params}
          />
        </CardContent>
      </Card>
    </div>
  );
}
