import Link from "next/link";
import { requireApiAccess } from "@/server/api-guard";
import { PERMISSIONS } from "@/server/permissions";
import { prisma } from "@/lib/prisma";
import { IncidentForm } from "./incident-form";
import { T } from "@/components/i18n/t";

export default async function NewIncidentPage() {
  const ctx = await requireApiAccess(PERMISSIONS.INCIDENT_CREATE);

  const [orgUnits, categories, severities] = await Promise.all([
    // Department-level units only — "Site" (Khu A/B/C) are PCCC record zones, not a place an
    // incident happened, and don't belong in this picker.
    prisma.orgUnit.findMany({ where: { organizationId: ctx.organizationId, isActive: true, unitType: { code: "DEPT" } }, orderBy: { name: "asc" } }),
    prisma.incidentCategory.findMany({ where: { organizationId: ctx.organizationId, isActive: true }, orderBy: { sortOrder: "asc" } }),
    prisma.incidentSeverity.findMany({ where: { organizationId: ctx.organizationId, isActive: true }, orderBy: { rank: "desc" } }),
  ]);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-2">
      <div>
        <Link href="/incidents" className="text-sm text-muted-foreground hover:underline">
          ← <T k="nav.incidents" />
        </Link>
        <h1 className="text-xl font-semibold"><T k="incidents.new.title" /></h1>
        <p className="hidden text-sm text-muted-foreground md:block"><T k="incidents.new.subtitle" /></p>
      </div>
      <IncidentForm
        orgUnits={orgUnits.map((u) => ({ id: u.id, name: u.name }))}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        severities={severities.map((s) => ({ id: s.id, name: s.name, code: s.code }))}
      />
    </div>
  );
}
