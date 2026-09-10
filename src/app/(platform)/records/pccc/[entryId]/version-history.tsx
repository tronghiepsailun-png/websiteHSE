"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useT } from "@/lib/i18n/locale-context";
import type { DictionaryKey } from "@/lib/i18n/translate";
import { STATUS_OUTLINE_CLASS } from "@/lib/status-tone";

type VersionFile = { id: string; fileName: string; storageType: string; url: string | null };

export type VersionHistoryEntry = {
  id: string;
  effectiveDate: Date | null;
  dateSourceQuote: string | null;
  dateConfidence: string;
  verificationStatus: string;
  notes: string | null;
  enteredAt: Date;
  enteredByName: string | null;
  isSuperseded: boolean;
  files: VersionFile[];
};

/** Collapsed to just the current version's one-line summary by default — a periodic record
 *  (e.g. a monthly self-inspection log) accumulates a version per period, and showing every
 *  past version on the page at once was the clutter, not just the per-version notes/files.
 *  "Xem chi tiết" reveals the full list (each row still expandable for notes/uploader/files);
 *  "Thu gọn" folds it back down to one line. */
export function VersionHistoryList({ versions }: { versions: VersionHistoryEntry[] }) {
  const t = useT();
  const [showAll, setShowAll] = useState(false);

  if (versions.length === 0) return <EmptyState message={<EmptyLabel />} />;

  if (!showAll) {
    const current = versions.find((v) => !v.isSuperseded) ?? versions[0];
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <VersionSummary version={current} />
        <button type="button" onClick={() => setShowAll(true)} className="ml-auto shrink-0 text-xs text-primary hover:underline">
          {t("records.detail.viewDetail")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-end">
        <button type="button" onClick={() => setShowAll(false)} className="shrink-0 text-xs text-primary hover:underline">
          {t("records.detail.hideDetail")}
        </button>
      </div>
      <div className="flex flex-col divide-y">
        {versions.map((v) => (
          <VersionHistoryRow key={v.id} version={v} />
        ))}
      </div>
    </div>
  );
}

function EmptyLabel() {
  const t = useT();
  return <>{t("records.detail.noVersions")}</>;
}

function VersionSummary({ version: v }: { version: VersionHistoryEntry }) {
  const t = useT();
  return (
    <>
      <Badge variant={v.isSuperseded ? "secondary" : "outline"} className={v.isSuperseded ? "" : STATUS_OUTLINE_CLASS.success}>
        {t(v.isSuperseded ? "records.detail.supersededBadge" : "records.detail.currentBadge")}
      </Badge>
      <span className="font-medium">
        {v.effectiveDate ? new Date(v.effectiveDate).toLocaleDateString() : t("records.dateConfidence.unknown")}
      </span>
      <span className="text-muted-foreground">· {t(`records.dateConfidence.${v.dateConfidence}` as DictionaryKey)}</span>
      {v.verificationStatus !== "ok" && (
        <Badge variant="outline" className="border-destructive/30 text-destructive">
          {t(`records.verificationStatus.${v.verificationStatus}` as DictionaryKey)}
        </Badge>
      )}
    </>
  );
}

function VersionHistoryRow({ version: v }: { version: VersionHistoryEntry }) {
  const t = useT();

  return (
    <div className="flex flex-col gap-1.5 py-3 text-sm first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-2">
        <VersionSummary version={v} />
      </div>
      {v.dateSourceQuote && <p className="text-xs text-muted-foreground">{v.dateSourceQuote}</p>}
      {v.notes && <p className="text-muted-foreground">{v.notes}</p>}
      <p className="text-xs text-muted-foreground">
        {t("records.detail.enteredBy")}: {v.enteredByName ?? "—"} · {new Date(v.enteredAt).toLocaleString()}
      </p>
      {v.files.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {v.files.map((f) => (
            <a
              key={f.id}
              href={f.storageType === "drive_link" ? (f.url ?? "#") : `/api/records/files/${f.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline"
            >
              {f.fileName}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
