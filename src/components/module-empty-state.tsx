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
  illustrationSrc,
}: {
  icon: ComponentType<{ className?: string }>;
  titleKey: DictionaryKey;
  messageKey: DictionaryKey;
  illustrationSrc?: string;
}) {
  const Icon = icon;
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted-foreground/10 text-muted-foreground">
            <Icon className="size-5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold">
              <T k={titleKey} />
            </h1>
            <p className="text-sm text-muted-foreground">
              <T k="modules.emptyHint" />
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {illustrationSrc ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={illustrationSrc} alt="" className="size-32" />
              <p className="text-sm text-muted-foreground">
                <T k={messageKey} />
              </p>
            </div>
          ) : (
            <EmptyState icon={icon} message={<T k={messageKey} />} className="py-16" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
