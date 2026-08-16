import type { ComponentType } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { T } from "@/components/i18n/t";
import type { DictionaryKey } from "@/lib/i18n/translate";

/**
 * The one building block behind every "khung sẵn — chưa có dữ liệu" module page:
 * a standard page header + a Card wrapping EmptyState. Once a module gets real
 * data/logic, its page.tsx is replaced outright — this component is scaffolding,
 * not meant to be extended with per-module props.
 */
export function ModuleEmptyState({
  icon,
  titleKey,
  messageKey,
}: {
  icon: ComponentType<{ className?: string }>;
  titleKey: DictionaryKey;
  messageKey: DictionaryKey;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">
          <T k={titleKey} />
        </h1>
        <p className="text-sm text-muted-foreground">
          <T k="modules.emptyHint" />
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <EmptyState icon={icon} message={<T k={messageKey} />} className="py-16" />
        </CardContent>
      </Card>
    </div>
  );
}
