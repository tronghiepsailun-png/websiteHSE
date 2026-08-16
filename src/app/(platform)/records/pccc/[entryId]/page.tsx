import Link from "next/link";
import { requireApiAccess } from "@/server/api-guard";
import { PERMISSIONS } from "@/server/permissions";
import { getRecordEntryDetail } from "@/server/records";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { T } from "@/components/i18n/t";
import type { DictionaryKey } from "@/lib/i18n/translate";
import { DataStatusBadge, ExpiryStatusBadge } from "../status-badges";
import { STATUS_OUTLINE_CLASS } from "@/lib/status-tone";

function hasPermission(permissionKeys: string[] | null, key: string) {
  return permissionKeys === null || permissionKeys.includes(key);
}

export default async function RecordEntryDetailPage({ params }: PageProps<"/records/pccc/[entryId]">) {
  const ctx = await requireApiAccess(PERMISSIONS.RECORDS_VIEW);
  const { entryId } = await params;

  const [entry, permissionKeys] = await Promise.all([
    getRecordEntryDetail(ctx.organizationId, entryId),
    ctx.isPlatformAdmin
      ? Promise.resolve(null)
      : prisma.userOrganizationRole
          .findMany({ where: { userId: ctx.userId, organizationId: ctx.organizationId }, include: { role: { include: { rolePermissions: { include: { permission: true } } } } } })
          .then((rows) => rows.flatMap((r) => r.role.rolePermissions.map((rp) => rp.permission.key))),
  ]);

  const canManage = hasPermission(permissionKeys, PERMISSIONS.RECORDS_MANAGE);
  const { recordType, orgUnit, currentVersion } = entry;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/records/pccc/list" className="text-sm text-muted-foreground hover:text-foreground">
          <T k="records.detail.backToList" />
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">
            {recordType.code} — {recordType.name}
          </h1>
          <p className="text-sm text-muted-foreground">{orgUnit.name}</p>
        </div>
        {canManage && (
          <Link href={`/records/pccc/${entry.id}/new-version`} className={buttonVariants()}>
            <T k="records.detail.addVersionButton" />
          </Link>
        )}
      </div>

      {/* 1. Catalog info (read-only) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            <T k="records.detail.catalogInfo" />
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={<T k="records.detail.legalBasis" />} value={recordType.legalBasis} />
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
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground"><T k="records.table.dataStatus" /></span>
            <DataStatusBadge status={entry.dataStatus} />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground"><T k="records.table.expiryStatus" /></span>
            <ExpiryStatusBadge status={entry.expiryStatus} />
          </div>
          <Field label={<T k="records.detail.effectiveDate" />} value={currentVersion?.effectiveDate ? new Date(currentVersion.effectiveDate).toLocaleDateString() : undefined} />
          <Field
            label={<T k="records.table.expiresAt" />}
            value={currentVersion?.expiresAt ? new Date(currentVersion.expiresAt).toLocaleDateString() : undefined}
          />
          <Field
            label={<T k="records.detail.dateConfidence" />}
            value={currentVersion ? <T k={`records.dateConfidence.${currentVersion.dateConfidence}` as DictionaryKey} /> : undefined}
          />
          <Field label={<T k="records.detail.responsiblePerson" />} value={entry.responsiblePerson} />
        </CardContent>
      </Card>

      {/* 4. Files of the currently-viewed (current) version */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            <T k="records.detail.files" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          {currentVersion && currentVersion.files.length > 0 ? (
            <ul className="flex flex-col gap-1.5">
              {currentVersion.files.map((f) => (
                <li key={f.id}>
                  <a
                    href={f.storageType === "drive_link" ? (f.url ?? "#") : `/api/records/files/${f.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline"
                  >
                    {f.fileName}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState message={<T k="records.detail.noFiles" />} />
          )}
        </CardContent>
      </Card>

      {/* 3. Version history timeline (incl. superseded) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            <T k="records.detail.versionHistory" />
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col divide-y">
          {entry.versions.map((v) => (
            <div key={v.id} className="flex flex-col gap-1.5 py-3 text-sm first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={v.isSuperseded ? "secondary" : "outline"} className={v.isSuperseded ? "" : STATUS_OUTLINE_CLASS.success}>
                  <T k={v.isSuperseded ? "records.detail.supersededBadge" : "records.detail.currentBadge"} />
                </Badge>
                <span className="font-medium">
                  {v.effectiveDate ? new Date(v.effectiveDate).toLocaleDateString() : <T k="records.dateConfidence.unknown" />}
                </span>
                <span className="text-muted-foreground">
                  · <T k={`records.dateConfidence.${v.dateConfidence}` as DictionaryKey} />
                </span>
                {v.verificationStatus !== "ok" && (
                  <Badge variant="outline" className="border-destructive/30 text-destructive">
                    <T k={`records.verificationStatus.${v.verificationStatus}` as DictionaryKey} />
                  </Badge>
                )}
              </div>
              {v.dateSourceQuote && <p className="text-xs text-muted-foreground">{v.dateSourceQuote}</p>}
              {v.notes && <p className="text-muted-foreground">{v.notes}</p>}
              <p className="text-xs text-muted-foreground">
                <T k="records.detail.enteredBy" />: {v.enteredBy?.name ?? "—"} · {new Date(v.enteredAt).toLocaleString()}
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
          ))}
          {entry.versions.length === 0 && <EmptyState message={<T k="records.detail.noVersions" />} />}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value ?? "—"}</span>
    </div>
  );
}
