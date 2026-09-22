import { AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { T } from "@/components/i18n/t";
import { ReportTabs } from "./report-tabs";
import type { ReportView } from "./report-view";

/** Title + tabs wrapped in one card (icon badge matching the page's own "Tổng số sự cố" KPI
 *  tone) instead of bare text sitting directly on the page background — gives this module's
 *  header the same card-based visual weight as every other section on the page. */
export function ModuleHeader({ active }: { active: ReportView }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-green-500/10 text-green-600">
            <AlertTriangle className="size-5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold">
              <T k="incidents.moduleName" />
            </h1>
            <p className="hidden text-sm text-muted-foreground md:block">
              <T k="incidents.pageSubtitle" />
            </p>
          </div>
        </div>
        <ReportTabs active={active} />
      </CardContent>
    </Card>
  );
}
