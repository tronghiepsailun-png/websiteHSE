import Link from "next/link";
import { tryApiAccess } from "@/server/api-guard";
import { NoPermissionState } from "@/components/no-permission-state";
import { PERMISSIONS } from "@/server/permissions";
import { listRecordEntries, localizeRecordType, localizeRecordGroup, type DataStatus, type ExpiryStatus } from "@/server/records";
import { listSites } from "@/server/records-catalog";
import { prisma } from "@/lib/prisma";
import { t } from "@/lib/i18n/translate";
import { getLocale } from "@/lib/i18n/get-locale.server";
import { cn } from "@/lib/utils";
import { REPORT_GRID_CLASS } from "@/lib/table-grid";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { TablePagination } from "@/components/ui/table-pagination";
import { T } from "@/components/i18n/t";
import { RecordsFilters } from "./records-filters";
import { DataStatusBadge } from "../status-badges";
import { STATUS_OUTLINE_CLASS } from "@/lib/status-tone";

const LIST_PAGE_SIZE = 20;

function parseFilterParam(value: unknown): string | undefined {
  if (typeof value !== "string" || value === "" || value === "all") return undefined;
  return value;
}

export default async function RecordsListPage({ searchParams }: PageProps<"/records/pccc/list">) {
  const access = await tryApiAccess(PERMISSIONS.RECORDS_VIEW);
  if ("denied" in access) return <NoPermissionState />;
  const ctx = access;
  const locale = await getLocale();
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

  // One row per record type (Mã), one column per zone — a record type used to repeat as one
  // row per zone, which meant scanning 3 rows to compare Khu A/B/C for the same document.
  // Collapsing to a row keeps the comparison in one line of sight; each zone cell still links
  // through to that zone's own entry for the full detail (expiry date, responsible person...).
  type Entry = (typeof entries)[number];
  const byRecordType = new Map<
    string,
    {
      recordTypeId: string;
      code: string;
      name: string;
      legalBasis: string | null;
      frequencyLabel: string | null;
      cycleMonths: number | null;
      responsibleUnit: string | null;
      sortOrder: number;
      groupSortOrder: number;
      byZone: Map<string, Entry>;
    }
  >();
  for (const e of entries) {
    const key = e.recordTypeId;
    if (!byRecordType.has(key)) {
      const recordType = localizeRecordType(e.recordType, locale);
      byRecordType.set(key, {
        recordTypeId: key,
        code: recordType.code,
        name: recordType.name,
        legalBasis: recordType.legalBasis,
        frequencyLabel: recordType.frequencyLabel,
        cycleMonths: recordType.cycleMonths,
        responsibleUnit: recordType.responsibleUnit,
        sortOrder: recordType.sortOrder,
        groupSortOrder: recordType.group.sortOrder,
        byZone: new Map(),
      });
    }
    byRecordType.get(key)!.byZone.set(e.orgUnitId, e);
  }
  const rows = [...byRecordType.values()].sort(
    (a, b) => a.groupSortOrder - b.groupSortOrder || a.sortOrder - b.sortOrder
  );

  const totalPages = Math.max(1, Math.ceil(rows.length / LIST_PAGE_SIZE));
  const pageClamped = Math.min(page, totalPages);
  const visible = viewAll ? rows : rows.slice((pageClamped - 1) * LIST_PAGE_SIZE, pageClamped * LIST_PAGE_SIZE);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/records/pccc" className="text-sm text-muted-foreground hover:underline">
          ← <T k="records.moduleName" />
        </Link>
        <h1 className="text-xl font-semibold">
          <T k="records.list.title" />
        </h1>
        <p className="hidden text-sm text-muted-foreground md:block">
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
        groups={groups.map((g) => {
          const lg = localizeRecordGroup(g, locale);
          return { id: lg.code, name: `${lg.code} · ${lg.name}` };
        })}
      />

      <Card>
        <CardContent className="pt-6">
          <Table className={cn(REPORT_GRID_CLASS, "table-fixed")}>
            <TableHeader>
              <TableRow className="h-11">
                <TableHead className="w-16"><T k="records.table.code" /></TableHead>
                <TableHead className="w-[200px]"><T k="records.table.name" /></TableHead>
                <TableHead className="w-[220px]"><T k="records.catalog.fields.legalBasis" /></TableHead>
                <TableHead className="w-[180px]"><T k="records.catalog.fields.frequencyLabel" /></TableHead>
                <TableHead className="w-[110px]"><T k="records.catalog.fields.cycleMonths" /></TableHead>
                <TableHead className="w-[150px]"><T k="records.catalog.fields.responsibleUnit" /></TableHead>
                {zones.map((z) => (
                  <TableHead key={z.id} className="w-16 px-2 text-center">{z.name}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((row) => (
                <TableRow key={row.recordTypeId} className="h-14">
                  <TableCell className="py-3 font-medium">{row.code}</TableCell>
                  <TableCell className="py-3 whitespace-normal">{row.name}</TableCell>
                  <TableCell className="py-3">
                    <span className="block truncate" title={row.legalBasis ?? undefined}>{row.legalBasis ?? "—"}</span>
                  </TableCell>
                  <TableCell className="py-3">
                    <span className="block truncate" title={row.frequencyLabel ?? undefined}>{row.frequencyLabel ?? "—"}</span>
                  </TableCell>
                  <TableCell className="py-3">
                    {row.cycleMonths ? <T k="records.detail.cycleMonthsValue" vars={{ n: row.cycleMonths }} /> : <T k="records.detail.cycleNone" />}
                  </TableCell>
                  <TableCell className="py-3">
                    <span className="block truncate" title={row.responsibleUnit ?? undefined}>{row.responsibleUnit ?? "—"}</span>
                  </TableCell>
                  {zones.map((z) => {
                    const entry = row.byZone.get(z.id);
                    // A record can be "Đủ" (data fully entered) and still be expired (the
                    // document itself is overdue for renewal) — those are two independent
                    // axes. Showing "Đủ" in that case read as "everything's fine" even though
                    // the dashboard's expiry warning table already flagged it. Expiry trouble
                    // is the more urgent fact, so it replaces the data-completeness label
                    // here instead of just decorating it.
                    const expiryOverride = entry?.expiryStatus === "expired" || entry?.expiryStatus === "expiring_soon";
                    const compactBadgeClass =
                      "h-auto min-h-5 w-full flex-wrap justify-center text-center leading-tight whitespace-normal break-words px-1";
                    return (
                      <TableCell key={z.id} className="w-16 px-2 py-3 text-center">
                        {entry ? (
                          <Link
                            href={`/records/pccc/${entry.id}`}
                            title={
                              expiryOverride
                                ? `${t(locale, `records.dataStatus.${entry.dataStatus}`)} · ${t(locale, `records.expiryStatus.${entry.expiryStatus}`)}`
                                : t(locale, `records.dataStatus.${entry.dataStatus}`)
                            }
                            className="block w-full hover:opacity-80"
                          >
                            {expiryOverride ? (
                              <Badge
                                variant="outline"
                                className={cn(
                                  compactBadgeClass,
                                  entry.expiryStatus === "expired" ? STATUS_OUTLINE_CLASS.critical : STATUS_OUTLINE_CLASS.warning
                                )}
                              >
                                {t(locale, `records.expiryStatus.${entry.expiryStatus}`)}
                              </Badge>
                            ) : (
                              <DataStatusBadge status={entry.dataStatus} className={compactBadgeClass} />
                            )}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
              {visible.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6 + zones.length}>
                    <EmptyState message={<T k="records.table.noResults" />} />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <TablePagination
            total={rows.length}
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
