import { Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { T } from "@/components/i18n/t";

/** Shown instead of a module's real content when the signed-in account can see the nav
 *  entry (every module is always listed, per design) but lacks the view permission for it —
 *  a friendlier outcome than a thrown ForbiddenError bubbling up to the generic error page.
 *  Styled to stand out (warning-toned icon badge, bold title) rather than read as a quiet
 *  empty state, since this is a distinct, actionable outcome ("go ask your admin"). */
export function NoPermissionState() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-warning/15 text-warning">
          <Lock className="size-7" />
        </span>
        <div className="flex flex-col gap-1">
          <p className="text-lg font-semibold text-foreground">
            <T k="common.noPermissionTitle" />
          </p>
          <p className="text-sm text-muted-foreground">
            <T k="common.noPermissionDescription" />
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
