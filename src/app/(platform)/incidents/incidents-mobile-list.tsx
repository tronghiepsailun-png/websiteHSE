"use client";

import { useState } from "react";
import Link from "next/link";
import { ShieldAlert, Wallet, CalendarCheck, TrendingDown, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { EmptyState } from "@/components/ui/empty-state";
import { TablePagination } from "@/components/ui/table-pagination";
import { FilterCountBadge } from "@/components/ui/filter-count-badge";
import { SeverityBadge, IncidentStatusBadge } from "@/components/incidents/severity-badge";
import { IncidentFilters } from "./incident-filters";
import { HorizontalScroll } from "@/components/ui/horizontal-scroll";
import { KpiCard, KPI_CARD_WIDTH_CLASS } from "@/components/ui/kpi-card";
import { T } from "@/components/i18n/t";
import type { DictionaryKey } from "@/lib/i18n/translate";

type Option = { id: string; name: string };

type MobileIncidentCard = {
  id: string;
  incidentNumber: string;
  factoryCode: string;
  severityName: string;
  severityColorHex: string | null;
  occurredAtDisplay: string;
  department: string;
  status: string;
  costDisplay: string;
};

function IncidentCard({ incident }: { incident: MobileIncidentCard }) {
  return (
    <Link
      href={`/incidents/${incident.id}`}
      className="flex flex-col gap-2 rounded-xl border bg-card p-3 active:bg-muted"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-semibold text-primary">{incident.incidentNumber}</span>
        <SeverityBadge name={incident.severityName} colorHex={incident.severityColorHex} />
      </div>
      <p className="text-sm text-muted-foreground">
        {incident.department} · {incident.occurredAtDisplay}
      </p>
      <div className="flex items-center justify-between">
        <IncidentStatusBadge status={incident.status} />
        <span className="text-sm font-medium">{incident.costDisplay}</span>
      </div>
    </Link>
  );
}

export function IncidentsMobileList({
  kpi,
  cards,
  totalCount,
  page,
  pageSize,
  viewAll,
  searchParams,
  filters,
}: {
  kpi: { totalIncidents: number; totalCostDisplay: string; daysSinceLastIncident: number | null; totalPointsDeducted: string };
  cards: MobileIncidentCard[];
  totalCount: number;
  page: number;
  pageSize: number;
  viewAll: boolean;
  searchParams: Record<string, string | string[] | undefined>;
  filters: {
    search?: string;
    status?: string;
    categoryId?: string;
    severityId?: string;
    categories: Option[];
    severities: Option[];
    carry: { year?: number; month?: number; week?: number; orgUnitId?: string };
    activeCount: number;
  };
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { activeCount, ...filterProps } = filters;

  return (
    <div className="flex flex-col gap-3">
      <HorizontalScroll className="flex gap-3">
        <div className={KPI_CARD_WIDTH_CLASS}>
          <KpiCard labelKey="incidents.kpi.totalIncidents" value={kpi.totalIncidents} icon={ShieldAlert} tone="success" />
        </div>
        <div className="w-[180px] shrink-0 md:w-auto md:shrink">
          <KpiCard
            labelKey="incidents.kpi.totalCost"
            value={kpi.totalCostDisplay}
            icon={Wallet}
            iconBg="#dbeafe"
            iconFg="#2563eb"
            valueClassName="text-lg leading-tight font-bold whitespace-nowrap"
          />
        </div>
        <div className={KPI_CARD_WIDTH_CLASS}>
          <KpiCard
            labelKey="incidents.kpi.daysSinceLastIncident"
            value={kpi.daysSinceLastIncident ?? "—"}
            icon={CalendarCheck}
            tone="warning"
          />
        </div>
        <div className={KPI_CARD_WIDTH_CLASS}>
          <KpiCard labelKey="incidents.kpi.totalPointsDeducted" value={kpi.totalPointsDeducted} icon={TrendingDown} iconBg="#f3e8ff" iconFg="#9333ea" />
        </div>
      </HorizontalScroll>

      <Button variant="outline" className="justify-between" onClick={() => setFiltersOpen(true)}>
        <span className="flex items-center gap-2">
          <SlidersHorizontal className="size-4" />
          <T k="common.filter" />
        </span>
        <FilterCountBadge count={activeCount} />
      </Button>

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
          <SheetTitle>
            <T k="common.filter" />
          </SheetTitle>
          <IncidentFilters {...filterProps} />
        </SheetContent>
      </Sheet>

      <div className="flex flex-col gap-2">
        {cards.map((incident) => (
          <IncidentCard key={incident.id} incident={incident} />
        ))}
        {cards.length === 0 && <EmptyState message={<T k={"incidents.table.noResults" as DictionaryKey} />} />}
      </div>

      <TablePagination
        total={totalCount}
        page={page}
        pageSize={pageSize}
        viewAll={viewAll}
        unitLabelKey="incidents.unitLabel"
        basePath="/incidents"
        searchParams={searchParams}
        hash="#incidents-list"
      />
    </div>
  );
}
