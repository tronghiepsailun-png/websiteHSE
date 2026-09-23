import { addMonths } from "date-fns";
import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/server/errors";
import { writeAuditLog } from "@/server/audit";
import { storageService } from "@/server/storage";
import { RECORD_ENTRY_SLOT_COUNT } from "@/lib/records-constants";
import type { Locale } from "@/lib/i18n/translate";

export { RECORD_ENTRY_SLOT_COUNT } from "@/lib/records-constants";

// The PCCC catalog (record type names, legal citations, frequency, responsible unit — plus
// the group names above them) is free-text data entered per organization, not app UI copy, so
// it can't go through the i18n dictionary like a label. Each field instead carries an optional
// `*Zh` sibling column; these two helpers resolve the pair down to one localized value/object,
// falling back to the Vietnamese original wherever no Chinese translation has been entered yet.
export function localizeRecordType<
  T extends {
    name: string;
    nameZh?: string | null;
    legalBasis: string | null;
    legalBasisZh?: string | null;
    frequencyLabel: string | null;
    frequencyLabelZh?: string | null;
    responsibleUnit: string | null;
    responsibleUnitZh?: string | null;
  },
>(recordType: T, locale: Locale): T {
  if (locale !== "zh") return recordType;
  return {
    ...recordType,
    name: recordType.nameZh || recordType.name,
    legalBasis: recordType.legalBasisZh || recordType.legalBasis,
    frequencyLabel: recordType.frequencyLabelZh || recordType.frequencyLabel,
    responsibleUnit: recordType.responsibleUnitZh || recordType.responsibleUnit,
  };
}

export function localizeRecordGroup<T extends { name: string; nameZh?: string | null }>(group: T, locale: Locale): T {
  if (locale !== "zh") return group;
  return { ...group, name: group.nameZh || group.name };
}

export const DATE_CONFIDENCES = ["confirmed", "estimated", "unknown"] as const;
export type DateConfidence = (typeof DATE_CONFIDENCES)[number];

export const VERIFICATION_STATUSES = ["ok", "needs_verification", "conflict"] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

// "missing" (no version at all) used to be its own status, separate from "needs_update"
// (has a version but not fully confirmed/verified). The user considers both the same actionable
// state — "Cần cập nhật" — and specifically wants a version that only has a Google Drive link
// (no real uploaded file) to count as needing an update too, not as already sufficient.
export const DATA_STATUSES = ["sufficient", "needs_update", "not_applicable"] as const;
export type DataStatus = (typeof DATA_STATUSES)[number];

export const EXPIRY_STATUSES = ["valid", "expiring_soon", "expired", "non_periodic"] as const;
export type ExpiryStatus = (typeof EXPIRY_STATUSES)[number];

export const EXPIRY_WARNING_DAYS = 60;

type MinimalEntry = { notApplicable: boolean };
type MinimalVersion =
  | { dateConfidence: string; verificationStatus: string; expiresAt: Date | null; files: { storageType: string }[] }
  | null;
type MinimalSlot = { fileName: string | null; storageType: string | null; startDate: Date | null; expiresAt: Date | null; uploadedAt: Date | null };

/** The slot boxes are the primary place new documents go now (see records.slots.title on the
 *  entry detail page) — "most recently uploaded to" rather than "highest slotIndex", since a
 *  user can fill boxes out of order. Falls back to null (no slots filled yet) so callers can
 *  fall back to the version-history data for entries never touched since the slots feature
 *  replaced the old "add new version" flow as the day-to-day update path. */
function mostRecentFilledSlot(slots: MinimalSlot[]): MinimalSlot | null {
  const filled = slots.filter((s): s is MinimalSlot & { uploadedAt: Date } => s.fileName !== null && s.uploadedAt !== null);
  if (filled.length === 0) return null;
  return filled.reduce((latest, s) => (s.uploadedAt > latest.uploadedAt! ? s : latest));
}

/** Trục 1 — mức độ đầy đủ dữ liệu. Luôn suy ra từ dữ liệu, không cho người dùng tự chọn.
 *  "Đủ" requires a real uploaded file, not just a Drive link — a link-only slot/version still
 *  needs the real document pushed up. Slots take priority over version history once any slot
 *  has been filled — that's the current, ongoing data source; the version row is either legacy
 *  (from before the slots feature) or a one-time historical import. */
export function computeDataStatus(entry: MinimalEntry, currentVersion: MinimalVersion, slots: MinimalSlot[] = []): DataStatus {
  if (entry.notApplicable) return "not_applicable";
  const slot = mostRecentFilledSlot(slots);
  if (slot) return slot.storageType === "upload" && slot.startDate ? "sufficient" : "needs_update";
  if (!currentVersion) return "needs_update";
  const hasRealFile = currentVersion.files.some((f) => f.storageType === "upload");
  if (hasRealFile && currentVersion.dateConfidence === "confirmed" && currentVersion.verificationStatus === "ok") {
    return "sufficient";
  }
  return "needs_update";
}

/** Trục 2 — mức độ còn hạn theo thời gian. Same slots-first priority as computeDataStatus. */
export function computeExpiryStatus(currentVersion: MinimalVersion, slots: MinimalSlot[] = []): ExpiryStatus {
  const slot = mostRecentFilledSlot(slots);
  const expiresAt = slot ? slot.expiresAt : (currentVersion?.expiresAt ?? null);
  if (!expiresAt) return "non_periodic";
  const daysLeft = daysUntil(expiresAt);
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
  versions: { where: { isSuperseded: false }, take: 1, include: { files: true } },
  slots: true,
} as const;

function withComputedStatus<T extends { notApplicable: boolean; versions: MinimalVersion[]; slots: MinimalSlot[] }>(entry: T) {
  const currentVersion = entry.versions[0] ?? null;
  const currentExpiresAt = mostRecentFilledSlot(entry.slots)?.expiresAt ?? currentVersion?.expiresAt ?? null;
  return {
    ...entry,
    currentVersion,
    currentExpiresAt,
    dataStatus: computeDataStatus(entry, currentVersion, entry.slots),
    expiryStatus: computeExpiryStatus(currentVersion, entry.slots),
    daysUntilExpiry: daysUntil(currentExpiresAt),
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
      slots: true,
    },
  });
  if (!entry || entry.organizationId !== organizationId) throw new NotFoundError("Record entry not found");

  const currentVersion = entry.versions.find((v) => !v.isSuperseded) ?? null;
  return {
    ...entry,
    currentVersion,
    dataStatus: computeDataStatus(entry, currentVersion, entry.slots),
    expiryStatus: computeExpiryStatus(currentVersion, entry.slots),
    daysUntilExpiry: daysUntil(mostRecentFilledSlot(entry.slots)?.expiresAt ?? currentVersion?.expiresAt ?? null),
  };
}

type ZoneBucket = { key: string; value: number; total: number; sufficient: number; needsUpdate: number };
export type ZoneStatusBucket = { key: string; sufficient: number; needsUpdate: number; expired: number };

export async function getRecordsDashboardData(organizationId: string, domainCode = "PCCC") {
  const entries = await listRecordEntries(organizationId, domainCode);

  const emptyBucket = () => ({ total: 0, sufficient: 0, needsUpdate: 0 });
  const byZoneMap = new Map<string, ReturnType<typeof emptyBucket>>();
  // Mutually-exclusive per-zone breakdown for the "Đủ / Cần cập nhật / Quá hạn" stacked chart —
  // unlike byZoneMap above (data-completeness axis only), an expired doc counts as "Quá hạn"
  // here regardless of its data-completeness status, since that's the more urgent fact about it.
  const emptyStatusBucket = () => ({ sufficient: 0, needsUpdate: 0, expired: 0 });
  const byZoneStatusMap = new Map<string, ReturnType<typeof emptyStatusBucket>>();

  let sufficientTotal = 0;
  let needsUpdateTotal = 0;
  let notApplicableTotal = 0;
  let expiringSoonTotal = 0;
  let expiredTotal = 0;

  for (const e of entries) {
    if (e.dataStatus === "not_applicable") {
      notApplicableTotal++;
    } else {
      const zoneKey = e.orgUnit.name;
      if (!byZoneMap.has(zoneKey)) byZoneMap.set(zoneKey, emptyBucket());
      if (!byZoneStatusMap.has(zoneKey)) byZoneStatusMap.set(zoneKey, emptyStatusBucket());
      const z = byZoneMap.get(zoneKey)!;
      const zs = byZoneStatusMap.get(zoneKey)!;
      z.total++;
      if (e.dataStatus === "sufficient") {
        z.sufficient++;
        sufficientTotal++;
      } else if (e.dataStatus === "needs_update") {
        z.needsUpdate++;
        needsUpdateTotal++;
      }
      if (e.expiryStatus === "expired") zs.expired++;
      else if (e.dataStatus === "sufficient") zs.sufficient++;
      else zs.needsUpdate++;
    }
    if (e.expiryStatus === "expiring_soon") expiringSoonTotal++;
    if (e.expiryStatus === "expired") expiredTotal++;
  }

  const byZone: ZoneBucket[] = [...byZoneMap.entries()].map(([key, v]) => ({ key, value: v.sufficient, ...v }));
  const byZoneStatus: ZoneStatusBucket[] = [...byZoneStatusMap.entries()].map(([key, v]) => ({ key, ...v }));

  const warningList = entries
    .filter((e) => e.expiryStatus === "expiring_soon" || e.expiryStatus === "expired")
    .sort((a, b) => (a.daysUntilExpiry ?? 0) - (b.daysUntilExpiry ?? 0));

  return {
    totalTracked: entries.length - notApplicableTotal,
    sufficientTotal,
    needsUpdateTotal,
    notApplicableTotal,
    expiringSoonTotal,
    expiredTotal,
    byZone,
    byZoneStatus,
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

export type RecordEntrySlotView = {
  slotIndex: number;
  id: string | null;
  fileName: string | null;
  storageType: string | null;
  url: string | null;
  startDate: Date | null;
  expiresAt: Date | null;
  uploadedByName: string | null;
  uploadedAt: Date | null;
};

/** Always returns exactly RECORD_ENTRY_SLOT_COUNT slots (1..N), filled from whatever rows
 *  exist and padded with empty placeholders for the rest — so the UI can always render the
 *  same fixed set of boxes regardless of how many have actually been filled in yet. */
export async function getEntrySlots(entryId: string): Promise<RecordEntrySlotView[]> {
  const rows = await prisma.recordEntrySlot.findMany({ where: { entryId }, include: { uploadedBy: true } });
  const bySlot = new Map(rows.map((r) => [r.slotIndex, r]));

  return Array.from({ length: RECORD_ENTRY_SLOT_COUNT }, (_, i) => {
    const slotIndex = i + 1;
    const row = bySlot.get(slotIndex);
    return {
      slotIndex,
      id: row?.id ?? null,
      fileName: row?.fileName ?? null,
      storageType: row?.storageType ?? null,
      url: row?.url ?? null,
      startDate: row?.startDate ?? null,
      expiresAt: row?.expiresAt ?? null,
      uploadedByName: row?.uploadedBy?.name ?? null,
      uploadedAt: row?.uploadedAt ?? null,
    };
  });
}

/** Whichever slot was uploaded to most recently (by upload time, not by which period it
 *  belongs to) — its startDate is what "Ngày thực hiện gần nhất" on the entry should show,
 *  since for a periodic entry the 6 slots are where the real activity happens, not the
 *  separate version-history flow. Null when no slot has ever been filled. */
export function getMostRecentFilledSlot(slots: RecordEntrySlotView[]): RecordEntrySlotView | null {
  const filled = slots.filter((s): s is RecordEntrySlotView & { uploadedAt: Date } => s.uploadedAt !== null);
  if (filled.length === 0) return null;
  return filled.reduce((latest, s) => (s.uploadedAt > latest.uploadedAt! ? s : latest));
}

export type SetEntrySlotFileParams = {
  organizationId: string;
  userId: string | null;
  entryId: string;
  slotIndex: number;
  startDate: Date | null;
  expiresAt: Date | null;
} & (
  | { fileName: string; storageType: "upload"; storagePath: string; sizeBytes: number; mimeType: string }
  | { fileName: string; storageType: "drive_link"; url: string }
);

export async function setEntrySlotFile(params: SetEntrySlotFileParams) {
  const entry = await prisma.recordEntry.findUnique({ where: { id: params.entryId } });
  if (!entry || entry.organizationId !== params.organizationId) throw new NotFoundError("Record entry not found");

  const existing = await prisma.recordEntrySlot.findUnique({
    where: { entryId_slotIndex: { entryId: params.entryId, slotIndex: params.slotIndex } },
  });
  if (existing?.storagePath) await storageService.delete(existing.storagePath).catch(() => {});

  const data = {
    fileName: params.fileName,
    storageType: params.storageType,
    url: params.storageType === "drive_link" ? params.url : null,
    storagePath: params.storageType === "upload" ? params.storagePath : null,
    sizeBytes: params.storageType === "upload" ? params.sizeBytes : null,
    mimeType: params.storageType === "upload" ? params.mimeType : null,
    startDate: params.startDate,
    expiresAt: params.expiresAt,
    uploadedById: params.userId,
    uploadedAt: new Date(),
  };

  const slot = await prisma.recordEntrySlot.upsert({
    where: { entryId_slotIndex: { entryId: params.entryId, slotIndex: params.slotIndex } },
    create: { entryId: params.entryId, slotIndex: params.slotIndex, ...data },
    update: data,
  });

  await writeAuditLog({
    organizationId: params.organizationId,
    userId: params.userId,
    module: "records",
    recordType: "RecordEntrySlot",
    recordId: slot.id,
    action: existing ? "update" : "create",
  });

  // Slots are now the only place a user actually uploads a document, so "Lịch sử phiên bản"
  // is kept alive as a running log of that same activity — one entry per slot update — instead
  // of requiring the separate "Thêm phiên bản mới" step it used to. Doesn't affect
  // dataStatus/expiryStatus: those already read the slots directly once any slot is filled.
  await createRecordVersion({
    organizationId: params.organizationId,
    userId: params.userId,
    entryId: params.entryId,
    effectiveDate: params.startDate,
    dateSourceQuote: null,
    dateConfidence: params.startDate ? "confirmed" : "unknown",
    expiresAtOverride: params.expiresAt,
    verificationStatus: "ok",
    notes: `Tự động ghi nhận từ "Tài liệu cập nhật ${params.slotIndex}".`,
    files:
      params.storageType === "upload"
        ? [{ fileName: params.fileName, storageType: "upload", storagePath: params.storagePath, sizeBytes: params.sizeBytes, mimeType: params.mimeType }]
        : [{ fileName: params.fileName, storageType: "drive_link", url: params.url }],
  });

  return slot;
}

export async function clearEntrySlot(organizationId: string, userId: string | null, entryId: string, slotIndex: number) {
  const entry = await prisma.recordEntry.findUnique({ where: { id: entryId } });
  if (!entry || entry.organizationId !== organizationId) throw new NotFoundError("Record entry not found");

  const existing = await prisma.recordEntrySlot.findUnique({ where: { entryId_slotIndex: { entryId, slotIndex } } });
  if (!existing) return;

  if (existing.storagePath) await storageService.delete(existing.storagePath).catch(() => {});
  await prisma.recordEntrySlot.delete({ where: { id: existing.id } });

  await writeAuditLog({
    organizationId,
    userId,
    module: "records",
    recordType: "RecordEntrySlot",
    recordId: existing.id,
    action: "delete",
  });
}
