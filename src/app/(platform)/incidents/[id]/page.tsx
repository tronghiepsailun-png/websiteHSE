import Link from "next/link";
import { notFound } from "next/navigation";
import { Calendar, MapPin } from "lucide-react";
import { tryApiAccess } from "@/server/api-guard";
import { NoPermissionState } from "@/components/no-permission-state";
import { PERMISSIONS } from "@/server/permissions";
import {
  getIncidentById,
  getIncidentFactoryCode,
  MAX_INCIDENT_PHOTOS,
  localizeCategoryName,
  localizeDepartmentName,
  buildOrgUnitNameViMap,
  resolveEmployeeSnapshotNames,
  localizeEmployeeDisplayName,
} from "@/server/incidents";
import { NotFoundError } from "@/server/errors";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SeverityBadge, IncidentStatusBadge } from "@/components/incidents/severity-badge";
import { StatusForm } from "./status-form";
import { CorrectiveActionForm } from "./corrective-action-form";
import { EditIncidentDialog } from "./edit-incident-dialog";
import { AttachmentUploadForm } from "./attachment-upload-form";
import { IncidentPhotoGallery } from "./photo-gallery";
import { RecordTimeline } from "@/components/ui/record-timeline";
import { listAuditLogForRecord } from "@/server/audit";
import { deleteIncidentAttachmentAction } from "./actions";
import { DeleteIncidentButton } from "./delete-incident-button";
import { T } from "@/components/i18n/t";
import { getLocale } from "@/lib/i18n/get-locale.server";
import { t } from "@/lib/i18n/translate";
import { formatIncidentCost } from "@/lib/format";

function hasPermission(permissionKeys: string[] | null, key: string) {
  return permissionKeys === null || permissionKeys.includes(key);
}

function fmt(d: Date | null | undefined) {
  return d ? new Date(d).toLocaleString() : "—";
}

function Field({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

export default async function IncidentDetailPage({ params }: PageProps<"/incidents/[id]">) {
  const access = await tryApiAccess(PERMISSIONS.INCIDENT_VIEW);
  if ("denied" in access) return <NoPermissionState />;
  const ctx = access;
  const { id } = await params;
  const locale = await getLocale();

  const incident = await getIncidentById(ctx.organizationId, id).catch((error) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });
  const permissionKeys = ctx.isPlatformAdmin
    ? null
    : await prisma.userOrganizationRole
        .findMany({ where: { userId: ctx.userId, organizationId: ctx.organizationId }, include: { role: { include: { rolePermissions: { include: { permission: true } } } } } })
        .then((rows) => rows.flatMap((r) => r.role.rolePermissions.map((rp) => rp.permission.key)));

  const canEdit = hasPermission(permissionKeys, PERMISSIONS.INCIDENT_EDIT);
  const canUpload = hasPermission(permissionKeys, PERMISSIONS.DOCUMENT_UPLOAD);
  const canDeleteDoc = hasPermission(permissionKeys, PERMISSIONS.DOCUMENT_DELETE);
  const canDeleteIncident = hasPermission(permissionKeys, PERMISSIONS.INCIDENT_DELETE);

  // Fetched unconditionally (unlike categories/severities below) — needed for read-only display
  // localization too (nameViByName), not just canEdit's picker.
  const orgUnits = await prisma.orgUnit.findMany({
    // Department-level units only — "Site" (Khu A/B/C) are PCCC record zones, not a place an
    // incident happened, and don't belong in this picker.
    where: { organizationId: ctx.organizationId, isActive: true, unitType: { code: "DEPT" } },
    orderBy: { name: "asc" },
  });
  const [categories, severities] = canEdit
    ? await Promise.all([
        prisma.incidentCategory.findMany({ where: { organizationId: ctx.organizationId, isActive: true }, orderBy: { sortOrder: "asc" } }),
        prisma.incidentSeverity.findMany({ where: { organizationId: ctx.organizationId, isActive: true }, orderBy: { rank: "desc" } }),
      ])
    : [[], []];

  const nameViByName = buildOrgUnitNameViMap(orgUnits);
  const employeeSnapshotNamesByCode = await resolveEmployeeSnapshotNames(ctx.organizationId, [incident]);
  // Import bookkeeping columns — they hold the raw spreadsheet payload, which is noise in a
  // history meant to be read by a person.
  const auditEntries = await listAuditLogForRecord(ctx.organizationId, "incident", incident.id, {
    excludeFields: ["sourceRowData", "sourceSheet", "sourceRowNumber", "updatedAt"],
  });
  const auditFieldLabels: Record<string, string> = {
    status: t(locale, "common.status"),
    immediateCause: t(locale, "incidents.detail.immediateCause"),
    rootCause: t(locale, "incidents.detail.rootCause"),
    correctiveAction: t(locale, "incidents.new.fields.correctiveAction"),
    preventiveAction: t(locale, "incidents.detail.preventiveAction"),
    responsiblePersonId: t(locale, "incidents.detail.responsiblePerson"),
    severityId: t(locale, "incidents.new.fields.severity"),
    categoryId: t(locale, "incidents.new.fields.category"),
    occurredAt: t(locale, "incidents.new.fields.occurredAt"),
    costVnd: t(locale, "incidents.new.fields.cost"),
    costRmb: t(locale, "incidents.detail.costRmb"),
    description: t(locale, "incidents.detail.description"),
    notes: t(locale, "incidents.detail.notes"),
  };

  const photoDocs = incident.documents.filter((doc) => doc.fileType.startsWith("image/"));
  const otherDocs = incident.documents.filter((doc) => !doc.fileType.startsWith("image/"));

  return (
    <div className="flex flex-col gap-2">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link href="/incidents" className="text-sm text-muted-foreground hover:underline">
            ← <T k="nav.incidents" />
          </Link>
          <h1 className="text-xl font-semibold">{incident.incidentNumber}</h1>
        </div>
        <div className="flex items-center gap-2">
          <SeverityBadge name={incident.severity.name} colorHex={incident.severity.colorHex} />
          <IncidentStatusBadge status={incident.status} />
          {canEdit && (
            <EditIncidentDialog
              incident={incident}
              initialFactoryCode={getIncidentFactoryCode(incident)}
              orgUnits={orgUnits.map((u) => ({ id: u.id, name: u.name }))}
              categories={categories.map((c) => ({ id: c.id, name: c.name }))}
              severities={severities.map((s) => ({ id: s.id, name: s.name, code: s.code }))}
            />
          )}
          {canDeleteIncident && (
            <DeleteIncidentButton incidentId={incident.id} incidentNumber={incident.incidentNumber} redirectAfterDelete />
          )}
        </div>
      </div>

      {/* Condensed key-facts strip */}
      <Card size="sm">
        <CardContent className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-4">
          <Field label={<T k="incidents.table.factoryCode" />} value={getIncidentFactoryCode(incident)} />
          <Field label={<T k="incidents.table.severity" />} value={<SeverityBadge name={incident.severity.name} colorHex={incident.severity.colorHex} />} />
          <Field label={<T k="incidents.table.occurred" />} value={<span className="flex items-center gap-1.5"><Calendar className="size-3.5 text-muted-foreground" />{fmt(incident.occurredAt)}</span>} />
          <Field label={<T k="incidents.new.fields.locationDetail" />} value={<span className="flex items-center gap-1.5"><MapPin className="size-3.5 text-muted-foreground" />{incident.locationDetail ?? "—"}</span>} />
        </CardContent>
      </Card>

      {/* Two-column body */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left: description, corrective action, people & general info, status */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card size="sm">
            <CardContent>
              <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase"><T k="incidents.detail.description" /></p>
              <p className="text-sm whitespace-pre-wrap">{incident.description}</p>
            </CardContent>
          </Card>

          <Card size="sm">
            <CardContent className="flex flex-col gap-3">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase"><T k="incidents.detail.peopleAndInfo" /></p>
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <Field label={<T k="incidents.table.category" />} value={localizeCategoryName(incident.category, locale)} />
                <Field
                  label={<T k="incidents.table.department" />}
                  value={localizeDepartmentName(incident.orgUnit?.name ?? incident.departmentSnapshot ?? null, locale, nameViByName)}
                />
                <Field label={<T k="incidents.table.cost" />} value={formatIncidentCost(incident)} />
                <Field label={<T k="incidents.detail.pointsDeducted" />} value={incident.pointsDeducted ?? "—"} />
                <Field label={<T k="incidents.new.fields.equipment" />} value={incident.equipment ?? "—"} />
                <Field label={<T k="incidents.detail.injuredBodyPart" />} value={incident.injuredBodyPart ?? "—"} />
              </div>
              <div className="grid grid-cols-2 gap-3 border-t pt-3 text-sm sm:grid-cols-4">
                <Field
                  label={<T k="incidents.new.fields.employee" />}
                  value={localizeEmployeeDisplayName(incident, employeeSnapshotNamesByCode)}
                />
                <Field
                  label={<T k="incidents.detail.responsiblePerson" />}
                  value={
                    incident.responsiblePerson
                      ? locale === "vi"
                        ? incident.responsiblePerson.fullName
                        : (incident.responsiblePerson.fullNameZh ?? incident.responsiblePerson.fullName)
                      : (incident.responsiblePersonNameSnapshot ?? "—")
                  }
                />
                <Field label={<T k="incidents.detail.positionShift" />} value={`${incident.positionSnapshot ?? "—"} / ${incident.shiftSnapshot ?? "—"}`} />
              </div>
            </CardContent>
          </Card>

          <Card size="sm">
            <CardContent className="flex flex-col gap-3">
              <div>
                <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase"><T k="incidents.new.fields.correctiveAction" /></p>
                {canEdit ? (
                  <CorrectiveActionForm incident={incident} />
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{incident.correctiveAction ?? "—"}</p>
                )}
              </div>
              <div className="border-t pt-3">
                <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase"><T k="common.status" /></p>
                {canEdit ? <StatusForm incident={incident} /> : <p className="text-sm">{incident.status}</p>}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: photos — every tile is a true square (matches the server-side 1024x1024
            upload crop exactly), so a square source photo displays in full with no further
            cropping; only a non-square source gets cropped, and that already happened once,
            server-side, at upload time (see uploadIncidentAttachmentAction). Sized to its own
            content (no h-full stretch) so it doesn't trail empty space when the left column
            ends up taller. */}
        <div className="flex flex-col gap-4">
          <Card size="sm">
            <CardContent className="flex flex-col gap-3">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                <T k="incidents.detail.photos" /> ({photoDocs.length}/{MAX_INCIDENT_PHOTOS})
              </p>
              {canUpload && <AttachmentUploadForm incidentId={incident.id} />}
              <IncidentPhotoGallery photos={photoDocs} incidentId={incident.id} canDelete={canDeleteDoc} />
            </CardContent>
          </Card>

          <RecordTimeline entries={auditEntries} locale={locale} fieldLabels={auditFieldLabels} />
        </div>
      </div>

      {/* Last-updated footer, matching the reference layout's small bottom-right timestamp */}
      <p className="text-right text-xs text-muted-foreground">
        <T k="incidents.detail.lastUpdated" />: {fmt(incident.updatedAt)}
      </p>

      {/* Other (non-image) attachments — only shown when present */}
      {otherDocs.length > 0 && (
        <Card size="sm">
          <CardContent className="flex flex-col gap-2">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase"><T k="incidents.detail.otherAttachments" /></p>
            <div className="flex flex-col divide-y">
              {otherDocs.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between py-2 text-sm">
                  <a href={`/api/documents/${doc.id}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    {doc.fileName}
                  </a>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{(doc.sizeBytes / 1024).toFixed(0)} KB</span>
                    {canDeleteDoc && (
                      <form action={deleteIncidentAttachmentAction}>
                        <input type="hidden" name="documentId" value={doc.id} />
                        <input type="hidden" name="incidentId" value={incident.id} />
                        <Button type="submit" size="sm" variant="ghost"><T k="common.delete" /></Button>
                      </form>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
