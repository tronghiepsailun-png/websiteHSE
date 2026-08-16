import { prisma } from "@/lib/prisma";

/** Resolves an OrgUnit id for a flat department name, auto-creating it (and a lazy
 *  "DEPT" OrgUnitType) if it doesn't exist yet — same convention incident-import.ts and
 *  employee-import.ts established for departments, reused here for single-record forms. */
export async function resolveOrgUnitIdByName(organizationId: string, name: string): Promise<string> {
  const trimmed = name.trim();
  const existing = await prisma.orgUnit.findFirst({ where: { organizationId, name: trimmed } });
  if (existing) return existing.id;

  let unitType = await prisma.orgUnitType.findFirst({ where: { organizationId, code: "DEPT" } });
  if (!unitType) {
    unitType = await prisma.orgUnitType.create({ data: { organizationId, code: "DEPT", name: "Department", level: 0 } });
  }
  const code = `DEPT-${trimmed}`.slice(0, 60);
  const created = await prisma.orgUnit.create({ data: { organizationId, unitTypeId: unitType.id, code, name: trimmed } });
  return created.id;
}
