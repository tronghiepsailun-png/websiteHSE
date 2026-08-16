import { addMonths } from "date-fns";
import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/server/errors";
import { writeAuditLog } from "@/server/audit";

export const DATE_CONFIDENCES = ["confirmed", "estimated", "unknown"] as const;
export type DateConfidence = (typeof DATE_CONFIDENCES)[number];

export const VERIFICATION_STATUSES = ["ok", "needs_verification", "conflict"] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const DATA_STATUSES = ["sufficient", "needs_update", "missing", "not_applicable"] as const;
export type DataStatus = (typeof DATA_STATUSES)[number];

export const EXPIRY_STATUSES = ["valid", "expiring_soon", "expired", "non_periodic"] as const;
export type ExpiryStatus = (typeof EXPIRY_STATUSES)[number];

export const EXPIRY_WARNING_DAYS = 60;

type MinimalEntry = { notApplicable: boolean };
type MinimalVersion = { dateConfidence: string; verificationStatus: string; expiresAt: Date | null } | null;

/** Trục 1 — mức độ đầy đủ dữ liệu. Luôn suy ra từ dữ liệu, không cho người dùng tự chọn. */
export function computeDataStatus(entry: MinimalEntry, currentVersion: MinimalVersion): DataStatus {
  if (entry.notApplicable) return "not_applicable";
  if (!currentVersion) return "missing";
  if (currentVersion.dateConfidence === "confirmed" && currentVersion.verificationStatus === "ok") return "sufficient";
  return "needs_update";
}

/** Trục 2 — mức độ còn hạn theo thời gian. */
export function computeExpiryStatus(currentVersion: MinimalVersion): ExpiryStatus {
  if (!currentVersion || !currentVersion.expiresAt) return "non_periodic";
  const daysLeft = daysUntil(currentVersion.expiresAt);
  if (daysLeft! < 0) return "expired";
  if (daysLeft! <= EXPIRY_WARNING_DAYS) return "expiring_soon";
  return "valid";
}

export function daysUntil(date: Date | null): number | null {
  if (!date) return null;
  return Math.floor((date.getTime() - Date.now()) / 86_400_000);
}

const recordEntryInclude = {
  recordType: { include: { group: { include: { domain: true } } } },
  orgUnit: true,
  versions: { where: { isSuperseded: false }, take: 1 },
} as const;

function withComputedStatus<T extends { notApplicable: boolean; versions: MinimalVersion[] }>(entry: T) {
  const currentVersion = entry.versions[0] ?? null;
  return {
    ...entry,
    currentVersion,
    dataStatus: computeDataStatus(entry, currentVersion),
    expiryStatus: computeExpiryStatus(currentVersion),
    daysUntilExpiry: currentVersion ? daysUntil(currentVersion.expiresAt) : null,
  };
}

export type RecordEntryFilters = {
  orgUnitId?: string;
  groupCode?: string;
  dataStatus?: DataStatus;
  expiryStatus?: ExpiryStatus;
  search?: string;
};

/** All entries for a domain (e.g. PCCC), with both status axes computed — never cached,
 *  always derived from the current (non-superseded) version, same way incident dashboard
 *  KPIs are computed from raw rows rather than a stored field. */
export async function listRecordEntries(organizationId: string, domainCode: string, filters: RecordEntryFilters = {}) {
  const entries = await prisma.recordEntry.findMany({
    where: { organizationId, recordType: { group: { domain: { code: domainCode } } } },
    include: recordEntryInclude,
  });

  const withStatus = entries.map(withComputedStatus);
  const search = filters.search?.trim().toLowerCase();

  return withStatus
    .filter((e) => {
      if (filters.orgUnitId && e.orgUnitId !== filters.orgUnitId) return false;
      if (filters.groupCode && e.recordType.group.code !== filters.groupCode) return false;
      if (filters.dataStatus && e.dataStatus !== filters.dataStatus) return false;
      if (filters.expiryStatus && e.expiryStatus !== filters.expiryStatus) return false;
      if (search && !e.recordType.name.toLowerCase().includes(search) && !e.recordType.code.toLowerCase().includes(search)) return false;
      return true;
    })
    .sort(
      (a, b) =>
        a.recordType.group.sortOrder - b.recordType.group.sortOrder ||
        a.recordType.sortOrder - b.recordType.sortOrder ||
        a.orgUnit.name.localeCompare(b.orgUnit.name)
    );
}

export async function getRecordEntryDetail(organizationId: string, id: string) {
  const entry = await prisma.recordEntry.findUnique({
    where: { id },
    include: {
      recordType: { include: { group: { include: { domain: true } } } },
      orgUnit: true,
      versions: {
        include: { files: true, enteredBy: true },
        orderBy: { enteredAt: "desc" },
      },
    },
  });
  if (!entry || entry.organizationId !== organizationId) throw new NotFoundError("Record entry not found");

  const currentVersion = entry.versions.find((v) => !v.isSuperseded) ?? null;
  return {
    ...entry,
    currentVersion,
    dataStatus: computeDataStatus(entry, currentVersion),
    expiryStatus: computeExpiryStatus(currentVersion),
    daysUntilExpiry: currentVersion ? daysUntil(currentVersion.expiresAt) : null,
  };
}

type ZoneOrGroupBucket = { key: string; value: number; total: number; sufficient: number; needsUpdate: number; missing: number };

export async function getRecordsDashboardData(organizationId: string, domainCode = "PCCC") {
  const entries = await listRecordEntries(organizationId, domainCode);

  const emptyBucket = () => ({ total: 0, sufficient: 0, needsUpdate: 0, missing: 0 });
  const byZoneMap = new Map<string, ReturnType<typeof emptyBucket>>();
  const byGroupMap = new Map<string, ReturnType<typeof emptyBucket>>();

  let sufficientTotal = 0;
  let needsUpdateTotal = 0;
  let missingTotal = 0;
  let notApplicableTotal = 0;
  let expiringSoonTotal = 0;
  let expiredTotal = 0;

  for (const e of entries) {
    if (e.dataStatus === "not_applicable") {
      notApplicableTotal++;
    } else {
      const zoneKey = e.orgUnit.name;
      const groupKey = `${e.recordType.group.code} · ${e.recordType.group.name}`;
      if (!byZoneMap.has(zoneKey)) byZoneMap.set(zoneKey, emptyBucket());
      if (!byGroupMap.has(groupKey)) byGroupMap.set(groupKey, emptyBucket());
      const z = byZoneMap.get(zoneKey)!;
      const g = byGroupMap.get(groupKey)!;
      z.total++;
      g.total++;
      if (e.dataStatus === "sufficient") {
        z.sufficient++;
        g.sufficient++;
        sufficientTotal++;
      } else if (e.dataStatus === "needs_update") {
        z.needsUpdate++;
        g.needsUpdate++;
        needsUpdateTotal++;
      } else if (e.dataStatus === "missing") {
        z.missing++;
        g.missing++;
        missingTotal++;
      }
    }
    if (e.expiryStatus === "expiring_soon") expiringSoonTotal++;
    if (e.expiryStatus === "expired") expiredTotal++;
  }

  const toBuckets = (map: Map<string, ReturnType<typeof emptyBucket>>): ZoneOrGroupBucket[] =>
    [...map.entries()].map(([key, v]) => ({ key, value: v.sufficient, ...v }));

  const warningList = entries
    .filter((e) => e.expiryStatus === "expiring_soon" || e.expiryStatus === "expired")
    .sort((a, b) => (a.daysUntilExpiry ?? 0) - (b.daysUntilExpiry ?? 0));

  return {
    totalTracked: entries.length - notApplicableTotal,
    sufficientTotal,
    needsUpdateTotal,
    missingTotal,
    notApplicableTotal,
    expiringSoonTotal,
    expiredTotal,
    byZone: toBuckets(byZoneMap),
    byGroup: toBuckets(byGroupMap),
    warningList,
  };
}

/** Powers the "this date looks suspiciously close to another zone's date for the same
 *  record" soft warning — the exact class of mistake that caused the real Khu A/C
 *  fire-insurance date mixup the module was built to prevent. */
export async function getSameRecordTypeDates(recordTypeId: string, excludeEntryId: string) {
  const entries = await prisma.recordEntry.findMany({
    where: { recordTypeId, id: { not: excludeEntryId } },
    include: { orgUnit: true, versions: { where: { isSuperseded: false }, take: 1 } },
  });
  return entries
    .filter((e) => e.versions[0]?.effectiveDate)
    .map((e) => ({ orgUnitName: e.orgUnit.name, effectiveDate: e.versions[0].effectiveDate! }));
}

export type CreateRecordVersionFile = {
  fileName: string;
  storageType: "drive_link" | "upload";
  url?: string | null;
  storagePath?: string | null;
  sizeBytes?: number | null;
  mimeType?: string | null;
};

/** The "Thêm phiên bản mới" write path: creates the new version and, inside the same
 *  transaction, marks the prior current version superseded — never overwritten, never
 *  deleted, so full compliance history survives an audit. Reused by both the update
 *  form's server action and the one-time migration script. */
export async function createRecordVersion(params: {
  organizationId: string;
  userId: string | null;
  entryId: string;
  effectiveDate: Date | null;
  dateSourceQuote: string | null;
  dateConfidence: DateConfidence;
  expiresAtOverride: Date | null;
  verificationStatus: VerificationStatus;
  notes: string | null;
  files: CreateRecordVersionFile[];
}) {
  const entry = await prisma.recordEntry.findUnique({ where: { id: params.entryId }, include: { recordType: true } });
  if (!entry || entry.organizationId !== params.organizationId) throw new NotFoundError("Record entry not found");

  const expiresAt =
    params.expiresAtOverride ??
    (params.effectiveDate && entry.recordType.cycleMonths ? addMonths(params.effectiveDate, entry.recordType.cycleMonths) : null);

  const newVersion = await prisma.$transaction(async (tx) => {
    const current = await tx.recordVersion.findFirst({ where: { entryId: params.entryId, isSuperseded: false } });

    const created = await tx.recordVersion.create({
      data: {
        entryId: params.entryId,
        effectiveDate: params.effectiveDate,
        dateSourceQuote: params.dateSourceQuote,
        dateConfidence: params.dateConfidence,
        expiresAt,
        expiresAtIsManual: params.expiresAtOverride != null,
        verificationStatus: params.verificationStatus,
        notes: params.notes,
        enteredById: params.userId,
        files: { create: params.files.map((f) => ({ ...f, uploadedById: params.userId })) },
      },
    });

    if (current) {
      await tx.recordVersion.update({ where: { id: current.id }, data: { isSuperseded: true, supersededById: created.id } });
    }

    return created;
  });

  await writeAuditLog({
    organizationId: params.organizationId,
    userId: params.userId,
    module: "records",
    recordType: "RecordVersion",
    recordId: newVersion.id,
    action: "create",
  });

  return newVersion;
}
