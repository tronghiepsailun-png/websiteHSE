import Link from "next/link";
import { tryApiAccess } from "@/server/api-guard";
import { NoPermissionState } from "@/components/no-permission-state";
import { PERMISSIONS } from "@/server/permissions";
import { getRecordEntryDetail, getEntrySlots, getMostRecentFilledSlot, localizeRecordType } from "@/server/records";
import { prisma } from "@/lib/prisma";
import { getLocale } from "@/lib/i18n/get-locale.server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { T } from "@/components/i18n/t";
import type { DictionaryKey } from "@/lib/i18n/translate";
import { DataStatusBadge, ExpiryStatusBadge } from "../status-badges";
import { VersionHistoryList } from "./version-history";
import { RecordSlotsGrid } from "./record-slots";

function hasPermission(permissionKeys: string[] | null, key: string) {
  return permissionKeys === null || permissionKeys.includes(key);
}

export default async function RecordEntryDetailPage({ params }: PageProps<"/records/pccc/[entryId]">) {
  const access = await tryApiAccess(PERMISSIONS.RECORDS_VIEW);
  if ("denied" in access) return <NoPermissionState />;
  const ctx = access;
  const locale = await getLocale();
  const { entryId } = await params;

  const [entry, permissionKeys, slots] = await Promise.all([
    getRecordEntryDetail(ctx.organizationId, entryId),
    ctx.isPlatformAdmin
      ? Promise.resolve(null)
      : prisma.userOrganizationRole
          .findMany({ where: { userId: ctx.userId, organizationId: ctx.organizationId }, include: { role: { include: { rolePermissions: { include: { permission: true } } } } } })
          .then((rows) => rows.flatMap((r) => r.role.rolePermissions.map((rp) => rp.permission.key))),
    getEntrySlots(entryId),
  ]);

  const canManage = hasPermission(permissionKeys, PERMISSIONS.RECORDS_EDIT);
  const { orgUnit, currentVersion } = entry;
  const recordType = localizeRecordType(entry.recordType, locale);

  // "Ngày thực hiện gần nhất" / "Ngày hết hạn gần nhất" track whichever slot was uploaded to
  // most recently — for a periodic entry the 6 slots are where the real activity happens, so
  // that upload should be what "current" means here, not the separate (and, for slot-driven
  // entries, usually empty) version-history flow. Once a slot has ever been filled, a blank
  // expiry on it is a deliberate "this document doesn't expire" — worth saying explicitly,
  // not just showing the same blank dash used for "nothing entered yet".
  const mostRecentSlot = getMostRecentFilledSlot(slots);
  const latestEffectiveDate = mostRecentSlot?.startDate ?? currentVersion?.effectiveDate ?? null;
  const latestExpiresAt = mostRecentSlot ? mostRecentSlot.expiresAt : (currentVersion?.expiresAt ?? null);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/records/pccc/list" className="text-sm text-muted-foreground hover:text-foreground">
          <T k="records.detail.backToList" />
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-semibold">
          {recordType.code} — {recordType.name}
        </h1>
        <p className="text-sm text-muted-foreground">{orgUnit.name}</p>
      </div>

      {/* 1. Catalog info (read-only) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            <T k="records.detail.catalogInfo" />
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap justify-between gap-x-10 gap-y-4">
          <Field label={<T k="records.detail.legalBasis" />} value={recordType.legalBasis} className="max-w-sm" />
          <Field label={<T k="records.detail.frequency" />} value={recordType.frequencyLabel} />
          <Field
            label={<T k="records.detail.cycle" />}
            value={recordType.cycleMonths ? <T k="records.detail.cycleMonthsValue" vars={{ n: recordType.cycleMonths }} /> : <T k="records.detail.cycleNone" />}
          />
          <Field label={<T k="records.detail.responsibleUnit" />} value={recordType.responsibleUnit} />
        </CardContent>
      </Card>

      {/* 2. Current status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            <T k="records.detail.currentStatus" />
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap justify-between gap-x-10 gap-y-4">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground"><T k="records.table.dataStatus" /></span>
            <DataStatusBadge status={entry.dataStatus} />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground"><T k="records.table.expiryStatus" /></span>
            <ExpiryStatusBadge status={entry.expiryStatus} />
          </div>
          <Field label={<T k="records.detail.effectiveDate" />} value={latestEffectiveDate ? new Date(latestEffectiveDate).toLocaleDateString() : undefined} />
          <Field
            label={<T k="records.table.expiresAt" />}
            value={
              latestExpiresAt
                ? new Date(latestExpiresAt).toLocaleDateString()
                : mostRecentSlot
                  ? <T k="records.detail.noExpiry" />
                  : undefined
            }
          />
          <Field
            label={<T k="records.detail.dateConfidence" />}
            value={
              mostRecentSlot
                ? <T k={`records.dateConfidence.${mostRecentSlot.startDate ? "confirmed" : "unknown"}` as DictionaryKey} />
                : currentVersion
                  ? <T k={`records.dateConfidence.${currentVersion.dateConfidence}` as DictionaryKey} />
                  : undefined
            }
          />
          <Field label={<T k="records.detail.responsiblePerson" />} value={entry.responsiblePerson} />
        </CardContent>
      </Card>

      {/* 5. Fixed set of periodic uploads (e.g. monthly self-inspection logs) — independent
             of the version-history below, since every update's file should stay visible side
             by side rather than superseding the previous one. This replaced the old single
             "File đính kèm" card tied to the version-history flow: going forward the first
             document goes in slot 1, and each later update goes in the next slot. */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            <T k="records.slots.title" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RecordSlotsGrid
            entryId={entry.id}
            canManage={canManage}
            cycleMonths={entry.recordType.cycleMonths}
            slots={slots.map((s) => ({
              slotIndex: s.slotIndex,
              id: s.id,
              fileName: s.fileName,
              storageType: s.storageType,
              url: s.url,
              startDate: s.startDate ? s.startDate.toISOString() : null,
              expiresAt: s.expiresAt ? s.expiresAt.toISOString() : null,
            }))}
          />
        </CardContent>
      </Card>

      {/* 3. Version history timeline (incl. superseded) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            <T k="records.detail.versionHistory" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <VersionHistoryList
            versions={entry.versions.map((v) => ({
              id: v.id,
              effectiveDate: v.effectiveDate,
              dateSourceQuote: v.dateSourceQuote,
              dateConfidence: v.dateConfidence,
              verificationStatus: v.verificationStatus,
              notes: v.notes,
              enteredAt: v.enteredAt,
              enteredByName: v.enteredBy?.name ?? null,
              isSuperseded: v.isSuperseded,
              files: v.files,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value, className }: { label: React.ReactNode; value: React.ReactNode; className?: string }) {
  return (
    <div className={"flex flex-col gap-1 " + (className ?? "")}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value ?? "—"}</span>
    </div>
  );
}
