import { ShieldX } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ViolationsTabs } from "./violations-tabs";
import { T } from "@/components/i18n/t";

/** Shared header + tab bar for every /violations/* route — mirrors how the Incidents module's
 *  report views share one title and one ReportTabs bar. Each page below only renders its own
 *  content (KPI cards, filters, table); the module title/subtitle live here once. Title/tabs sit
 *  inside one card (icon badge + white background) instead of bare text on the page background,
 *  matching Incidents' ModuleHeader treatment. */
export default function ViolationsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-green-500/10 text-green-600">
              <ShieldX className="size-5" />
            </span>
            <div>
              <h1 className="text-xl font-semibold">
                <T k="violations.groupTitle" />
              </h1>
              <p className="text-sm text-muted-foreground">
                <T k="violations.groupSubtitle" />
              </p>
            </div>
          </div>
          <ViolationsTabs />
        </CardContent>
      </Card>
      {children}
    </div>
  );
}
