import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/server/errors";

/** The full catalog for one domain (e.g. PCCC): groups → types, in display order.
 *  This is shared, tenant-defined reference data — never duplicated per site. */
export async function getRecordCatalog(organizationId: string, domainCode = "PCCC") {
  const domain = await prisma.recordDomain.findFirst({
    where: { organizationId, code: domainCode },
    include: {
      groups: {
        orderBy: { sortOrder: "asc" },
        include: { types: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });
  if (!domain) throw new NotFoundError(`Record domain "${domainCode}" not found for this organization`);
  return domain;
}

export async function createRecordType(params: {
  groupId: string;
  code: string;
  name: string;
  nameZh?: string | null;
  legalBasis?: string | null;
  legalBasisZh?: string | null;
  frequencyLabel?: string | null;
  frequencyLabelZh?: string | null;
  cycleMonths?: number | null;
  responsibleUnit?: string | null;
  responsibleUnitZh?: string | null;
  sharedAcrossSites: boolean;
}) {
  const maxSortOrder = await prisma.recordType.aggregate({
    where: { groupId: params.groupId },
    _max: { sortOrder: true },
  });
  return prisma.recordType.create({
    data: { ...params, sortOrder: (maxSortOrder._max.sortOrder ?? 0) + 1 },
  });
}

export async function updateRecordType(
  id: string,
  params: {
    name: string;
    nameZh?: string | null;
    legalBasis?: string | null;
    legalBasisZh?: string | null;
    frequencyLabel?: string | null;
    frequencyLabelZh?: string | null;
    cycleMonths?: number | null;
    responsibleUnit?: string | null;
    responsibleUnitZh?: string | null;
    sharedAcrossSites: boolean;
  }
) {
  return prisma.recordType.update({ where: { id }, data: params });
}

export async function setRecordTypeActive(id: string, isActive: boolean) {
  return prisma.recordType.update({ where: { id }, data: { isActive } });
}

/** "Áp dụng cho khu" — bulk-creates the missing RecordEntry rows for the selected sites.
 *  Never touches an existing entry (and never deletes one), so re-applying is always safe. */
export async function applyRecordTypeToSites(organizationId: string, recordTypeId: string, orgUnitIds: string[]) {
  if (orgUnitIds.length === 0) return { created: 0 };

  const existing = await prisma.recordEntry.findMany({
    where: { recordTypeId, orgUnitId: { in: orgUnitIds } },
    select: { orgUnitId: true },
  });
  const existingSet = new Set(existing.map((e) => e.orgUnitId));
  const toCreate = orgUnitIds.filter((id) => !existingSet.has(id));
  if (toCreate.length === 0) return { created: 0 };

  await prisma.recordEntry.createMany({
    data: toCreate.map((orgUnitId) => ({ organizationId, recordTypeId, orgUnitId })),
  });
  return { created: toCreate.length };
}

/** Sites (OrgUnits) available to apply a record type to — any org unit under the "SITE"
 *  type, so this stays correct if the tenant later renames or adds site-level units. */
export async function listSites(organizationId: string) {
  return prisma.orgUnit.findMany({
    where: { organizationId, isActive: true, unitType: { code: "SITE" } },
    orderBy: { name: "asc" },
  });
}
