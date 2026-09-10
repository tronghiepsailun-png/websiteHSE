import { ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { SecurityTabs } from "./security-tabs";
import { T } from "@/components/i18n/t";

/** Shared header + tab bar for every /employees/security/* route — mirrors how the Violations
 *  module's own layout.tsx shares one title/tab-bar card across its sub-routes. Chấm công and
 *  Đánh giá khảo hạch used to be two separate sidebar entries; merged here into one "Quản lý bảo
 *  an" section per the user's request. */
export default function EmployeeSecurityLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600">
              <ShieldCheck className="size-5" />
            </span>
            <div>
              <h1 className="text-xl font-semibold">
                <T k="nav.employeeSecurity" />
              </h1>
              <p className="text-sm text-muted-foreground">
                <T k="employees.security.groupSubtitle" />
              </p>
            </div>
          </div>
          <SecurityTabs />
        </CardContent>
      </Card>
      {children}
    </div>
  );
}
