import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { T } from "@/components/i18n/t";
import { HorizontalScroll } from "@/components/ui/horizontal-scroll";
import type { InventoryItemView } from "./item-card";

const BAR_HEIGHT_PX = 120;
// Bars are scaled relative to each item's own tiêu chuẩn (minStockLevel), not to each other —
// a bar reaching the dashed line means "at standard". Capped at 2x standard so one overstocked
// item can't flatten every other bar.
const SCALE_CAP = 2;

export function InventoryStockChart({ items, mobile = false }: { items: InventoryItemView[]; mobile?: boolean }) {
  function renderBar(item: InventoryItemView) {
    const ratio = item.minStockLevel > 0 ? item.stock / item.minStockLevel : item.stock > 0 ? 1 : 0;
    const barPercent = Math.min(ratio / SCALE_CAP, 1) * 100;
    const thresholdPercent = item.minStockLevel > 0 ? (1 / SCALE_CAP) * 100 : 0;
    const low = item.stock < item.minStockLevel;

    return (
      <div
        key={item.id}
        className="flex w-[72px] shrink-0 flex-col items-center gap-1.5 rounded-lg border border-border/60 bg-muted/20 px-1.5 py-2.5"
      >
        <span className={"text-xs font-semibold " + (low ? "text-destructive" : "text-foreground")}>{item.stock}</span>
        <div className="relative flex items-end justify-center" style={{ height: BAR_HEIGHT_PX, width: 22 }}>
          {item.minStockLevel > 0 && (
            <div className="absolute inset-x-0 border-t border-dashed border-border" style={{ bottom: `${thresholdPercent}%` }} />
          )}
          <div
            className={"w-full rounded-t-sm " + (low ? "bg-destructive/80" : "bg-[var(--chart-brand)]")}
            style={{ height: `${Math.max(barPercent, item.stock > 0 ? 2 : 0)}%` }}
          />
        </div>
        <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-md border border-border/60 bg-white">
          {item.imageUrl ? (
            <Image src={item.imageUrl} alt={item.name} width={36} height={36} className="h-full w-full object-contain" />
          ) : null}
        </div>
        <span className="line-clamp-2 text-center text-[10px] leading-tight text-muted-foreground">{item.name}</span>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">
          <T k="inventory.chart.title" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {mobile ? (
          <HorizontalScroll className="flex gap-2">{items.map(renderBar)}</HorizontalScroll>
        ) : (
          <div className="flex flex-wrap gap-2">{items.map(renderBar)}</div>
        )}
      </CardContent>
    </Card>
  );
}
