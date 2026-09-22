"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { T } from "@/components/i18n/t";
import { useT } from "@/lib/i18n/locale-context";
import { t, type DictionaryKey, type Locale } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";
import type { AuditEntry } from "@/server/audit";

const ACTION_STYLE: Record<string, { icon: typeof Plus; dot: string; labelKey: DictionaryKey }> = {
  create: { icon: Plus, dot: "bg-green-500/15 text-green-600", labelKey: "audit.action.create" },
  update: { icon: Pencil, dot: "bg-blue-500/15 text-blue-600", labelKey: "audit.action.update" },
  delete: { icon: Trash2, dot: "bg-red-500/15 text-red-600", labelKey: "audit.action.delete" },
};

function fmtDateTime(d: Date) {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const MAX_VALUE_CHARS = 120;

/** Audit values are stored as `String(value)`, so dates arrive as raw JS/ISO date strings and
 *  long text arrives in full. Both read badly in a narrow timeline column. */
function formatValue(raw: string | null) {
  if (!raw) return "—";
  // Letters (Mon/Aug/GMT) or an ISO time marker separate a real date from a bare number like
  // "180000", which some engines would otherwise happily parse as a date.
  const looksLikeDate = /\d{4}/.test(raw) && (/[A-Za-z]{3}/.test(raw) || /T\d{2}:/.test(raw));
  if (looksLikeDate) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return fmtDateTime(parsed);
  }
  return raw.length > MAX_VALUE_CHARS ? `${raw.slice(0, MAX_VALUE_CHARS)}…` : raw;
}

/** Read-only change history for one record, rendered from the AuditLog rows that every
 *  mutating server action already writes. `fieldLabels` maps a stored fieldName to the label
 *  the user sees in the form — unmapped fields fall back to the raw name rather than hiding. */
export function RecordTimeline({
  entries,
  locale,
  fieldLabels = {},
}: {
  entries: AuditEntry[];
  locale: Locale;
  fieldLabels?: Record<string, string>;
}) {
  const ct = useT();
  const [expanded, setExpanded] = useState(false);

  return (
    <Card>
      <CardHeader className="pb-3">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center justify-between gap-2 outline-none"
        >
          <CardTitle className="text-base font-semibold">
            <T k="audit.title" />
          </CardTitle>
          <span className="flex items-center gap-1 text-xs font-medium text-primary">
            {expanded ? ct("common.hideDetails") : ct("common.viewDetails")}
            <ChevronDown className={cn("size-3.5 transition-transform duration-150", expanded && "rotate-180")} />
          </span>
        </button>
      </CardHeader>
      {expanded && (
      <CardContent className="pt-0">
        {entries.length === 0 ? (
          <EmptyState message={<T k="audit.empty" />} />
        ) : (
          <ol className="flex flex-col gap-3">
            {entries.map((entry) => {
              const style = ACTION_STYLE[entry.action] ?? ACTION_STYLE.update;
              const Icon = style.icon;
              return (
                <li key={entry.id} className="flex items-start gap-3">
                  <span className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${style.dot}`}>
                    <Icon className="size-3.5" />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <p className="text-sm">
                      <span className="font-medium">{entry.userName ?? t(locale, "audit.unknownUser")}</span>{" "}
                      <span className="text-muted-foreground">{t(locale, style.labelKey)}</span>
                      {entry.fieldName && (
                        // Labels are reused from the forms, where a trailing "*" marks a required
                        // field — meaningless when read back as history.
                        <span className="font-medium"> {(fieldLabels[entry.fieldName] ?? entry.fieldName).replace(/\s*\*$/, "")}</span>
                      )}
                    </p>
                    {entry.fieldName && (
                      <p className="text-xs break-words text-muted-foreground">
                        <span className="line-through">{formatValue(entry.oldValue)}</span> → <span className="text-foreground">{formatValue(entry.newValue)}</span>
                      </p>
                    )}
                    <time className="text-xs text-muted-foreground">{fmtDateTime(entry.createdAt)}</time>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
      )}
    </Card>
  );
}
