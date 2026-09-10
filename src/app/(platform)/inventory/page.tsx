import Link from "next/link";
import { cookies } from "next/headers";
import { Package, AlertTriangle, Warehouse } from "lucide-react";
import { tryApiAccess } from "@/server/api-guard";
import { NoPermissionState } from "@/components/no-permission-state";
import { PERMISSIONS } from "@/server/permissions";
import { getPermissionKeysForUserInOrg } from "@/server/rbac";
import {
  getInventoryDashboardData,
  listInventoryTransactions,
  listActiveSafetyWorkshops,
  getIssuanceTotalsByItem,
  getStockInTotalsByItem,
  localizeInventoryItem,
} from "@/server/inventory";
import { getLocale } from "@/lib/i18n/get-locale.server";
import { t, type DictionaryKey } from "@/lib/i18n/translate";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { T } from "@/components/i18n/t";
import { STATUS_TILE_CLASS } from "@/lib/status-tone";
import { InventoryItemCard } from "./item-card";
import { InventoryStockChart } from "./inventory-stock-chart";
import { IssuanceReport } from "./issuance-report";
import { StockInReport } from "./stockin-report";
import { ISSUANCE_COLUMNS_COOKIE, ISSUANCE_TOGGLEABLE_COLUMNS } from "./column-visibility";
import { parseHiddenColumns } from "@/lib/column-visibility";
import { InventoryTabs } from "./inventory-tabs";

export default async function InventoryPage({ searchParams }: PageProps<"/inventory">) {
  const access = await tryApiAccess(PERMISSIONS.INVENTORY_VIEW);
  if ("denied" in access) return <NoPermissionState />;
  const ctx = access;
  const locale = await getLocale();
  const params = await searchParams;
  const cookieStore = await cookies();
  const hiddenIssuanceColumns = parseHiddenColumns(cookieStore.get(ISSUANCE_COLUMNS_COOKIE)?.value, ISSUANCE_TOGGLEABLE_COLUMNS);

  const orgPermissionKeys = ctx.isPlatformAdmin ? null : await getPermissionKeysForUserInOrg(ctx.userId, ctx.organizationId);
  const canEdit = ctx.isPlatformAdmin || orgPermissionKeys!.has(PERMISSIONS.INVENTORY_EDIT);
  const canDelete = ctx.isPlatformAdmin || orgPermissionKeys!.has(PERMISSIONS.INVENTORY_DELETE);

  const view = params.view === "issuance" ? "issuance" : params.view === "stockin" ? "stockin" : "stock";
  const departmentFilter = typeof params.dept === "string" ? params.dept.trim() : "";

  const [data, workshopsRaw] = await Promise.all([getInventoryDashboardData(ctx.organizationId), listActiveSafetyWorkshops(ctx.organizationId)]);
  const items = data.items.map((item) => localizeInventoryItem(item, locale));
  const workshops = workshopsRaw.map((w) => ({ id: w.id, name: locale === "vi" && w.nameVi ? w.nameVi : w.name }));

  const [issuanceRowsRaw, issuanceChartRaw] =
    view === "issuance"
      ? await Promise.all([
          listInventoryTransactions(ctx.organizationId, { type: "out", department: departmentFilter || undefined, excludeAdjustments: true }),
          getIssuanceTotalsByItem(ctx.organizationId, { department: departmentFilter || undefined }),
        ])
      : [[], []];
  const issuanceRows = issuanceRowsRaw.map((row) => ({ ...row, item: localizeInventoryItem(row.item, locale) }));
  const issuanceChartItems = issuanceChartRaw.map((item) => localizeInventoryItem(item, locale));

  const [stockInRowsRaw, stockInChartRaw] =
    view === "stockin"
      ? await Promise.all([
          listInventoryTransactions(ctx.organizationId, { type: "in", excludeAdjustments: true }),
          getStockInTotalsByItem(ctx.organizationId),
        ])
      : [[], []];
  const stockInRows = stockInRowsRaw.map((row) => ({ ...row, item: localizeInventoryItem(row.item, locale) }));
  const stockInChartItems = stockInChartRaw.map((item) => localizeInventoryItem(item, locale));

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600">
              <Warehouse className="size-5" />
            </span>
            <div>
              <h1 className="text-xl font-semibold">
                <T k="inventory.pageTitle" />
              </h1>
              <p className="text-sm text-muted-foreground">
                <T k="inventory.pageSubtitle" />
              </p>
            </div>
          </div>
          <InventoryTabs active={view} canManageCatalog={canEdit} />
        </CardContent>
      </Card>

      {view === "stock" ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiCard labelKey="inventory.kpi.totalItems" value={data.totalItems} icon={Package} tone="neutral" />
            <KpiCard labelKey="inventory.kpi.lowStock" value={data.lowStockCount} icon={AlertTriangle} tone={data.lowStockCount > 0 ? "critical" : "success"} />
          </div>

          {items.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <EmptyState message={<T k="inventory.empty.noItems" />} />
              </CardContent>
            </Card>
          ) : (
            <>
              <InventoryStockChart items={items} />
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
                {items.map((item) => (
                  <InventoryItemCard key={item.id} item={item} canEdit={canEdit} workshops={workshops} />
                ))}
              </div>
            </>
          )}
        </>
      ) : view === "issuance" ? (
        <>
          <div className="flex items-center justify-end">
            <form method="get" className="flex items-center gap-2">
              <input type="hidden" name="view" value="issuance" />
              <Input name="dept" placeholder={t(locale, "inventory.issuance.filter.departmentPlaceholder")} defaultValue={departmentFilter} className="h-8 w-52" />
              <Button type="submit" size="sm" variant="outline">
                {t(locale, "inventory.issuance.filter.submit")}
              </Button>
              {departmentFilter && (
                <Link href="/inventory?view=issuance" className="text-xs text-muted-foreground hover:text-foreground hover:underline">
                  {t(locale, "inventory.issuance.filter.clear")}
                </Link>
              )}
            </form>
          </div>
          <IssuanceReport
            chartItems={issuanceChartItems}
            rows={issuanceRows}
            locale={locale}
            canEdit={canEdit}
            canDelete={canDelete}
            workshops={workshops}
            hiddenColumns={[...hiddenIssuanceColumns]}
          />
        </>
      ) : (
        <StockInReport chartItems={stockInChartItems} rows={stockInRows} locale={locale} canEdit={canEdit} canDelete={canDelete} />
      )}
    </div>
  );
}

function KpiCard({
  labelKey,
  value,
  icon: Icon,
  tone,
}: {
  labelKey: DictionaryKey;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone: keyof typeof STATUS_TILE_CLASS;
}) {
  const tile = STATUS_TILE_CLASS[tone];
  return (
    <Card className={tile.border}>
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
        <div>
          <CardDescription className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            <T k={labelKey} />
          </CardDescription>
          <CardTitle className="text-2xl leading-none font-bold">{value}</CardTitle>
        </div>
        <div className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${tile.iconBg} ${tile.iconFg}`}>
          <Icon className="size-4" />
        </div>
      </CardHeader>
    </Card>
  );
}
