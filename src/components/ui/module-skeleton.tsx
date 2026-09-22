import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading scaffold shared by every module route's loading.tsx. The shape mirrors
 * the real module layout (icon-badge header, optional KPI strip, content block)
 * so swapping skeleton -> content doesn't shift the page.
 */
export function ModuleSkeleton({
  kpis = 0,
  rows = 8,
  toolbar = false,
}: {
  kpis?: number;
  rows?: number;
  toolbar?: boolean;
}) {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="flex items-center gap-3">
          <Skeleton className="size-10 shrink-0 rounded-xl" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-3.5 w-64" />
          </div>
        </CardContent>
      </Card>

      {kpis > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: kpis }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="gap-2 pb-2">
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="h-7 w-16" />
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {toolbar && <Skeleton className="h-14 w-full rounded-xl" />}

      <Card>
        <CardContent className="flex flex-col gap-3 pt-6">
          {Array.from({ length: rows }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
