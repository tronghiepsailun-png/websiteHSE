import Link from "next/link";
import { notFound } from "next/navigation";
import { X, Calendar, MapPin } from "lucide-react";
import { requireApiAccess } from "@/server/api-guard";
import { PERMISSIONS } from "@/server/permissions";
import { getIncidentById, MAX_INCIDENT_PHOTOS } from "@/server/incidents";
import { NotFoundError } from "@/server/errors";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SeverityBadge, IncidentStatusBadge } from "@/components/incidents/severity-badge";
import { StatusForm } from "./status-form";
import { CorrectiveActionForm } from "./corrective-action-form";
import { AttachmentUploadForm } from "./attachment-upload-form";
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
  const ctx = await requireApiAccess(PERMISSIONS.INCIDENT_VIEW);
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
          {canDeleteIncident && (
            <DeleteIncidentButton incidentId={incident.id} incidentNumber={incident.incidentNumber} redirectAfterDelete />
          )}
        </div>
      </div>

      {/* Condensed key-facts strip */}
      <Card size="sm">
        <CardContent className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
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
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                <Field label={<T k="incidents.table.category" />} value={incident.category.name} />
                <Field label={<T k="incidents.new.fields.orgUnit" />} value={incident.orgUnit?.name ?? "—"} />
                <Field label={<T k="incidents.table.department" />} value={incident.orgUnit?.name ?? incident.departmentSnapshot ?? "—"} />
                <Field label={<T k="incidents.table.cost" />} value={formatIncidentCost(incident)} />
                <Field label={<T k="incidents.detail.pointsDeducted" />} value={incident.pointsDeducted ?? "—"} />
                <Field label={<T k="incidents.new.fields.equipment" />} value={incident.equipment ?? "—"} />
                <Field label={<T k="incidents.detail.injuredBodyPart" />} value={incident.injuredBodyPart ?? "—"} />
              </div>
              <div className="grid grid-cols-2 gap-3 border-t pt-3 text-sm sm:grid-cols-3">
                <Field label={<T k="incidents.table.employee" />} value={incident.employeeNameSnapshot ?? "—"} />
                <Field label={<T k="incidents.detail.responsiblePerson" />} value={incident.responsiblePerson?.fullName ?? incident.responsiblePersonNameSnapshot ?? "—"} />
                <Field label={<T k="incidents.detail.reportedBy" />} value={incident.reportedBy?.name ?? "—"} />
                <Field label={<T k="incidents.detail.positionShift" />} value={`${incident.positionSnapshot ?? "—"} / ${incident.shiftSnapshot ?? "—"}`} />
                <Field label={<T k="incidents.detail.departmentAtTime" />} value={incident.departmentSnapshot ?? "—"} />
              </div>
            </CardContent>
          </Card>

          <Card size="sm">
            <CardContent>
              <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase"><T k="incidents.new.fields.correctiveAction" /></p>
              {canEdit ? (
                <CorrectiveActionForm incident={incident} />
              ) : (
                <p className="text-sm whitespace-pre-wrap">{incident.correctiveAction ?? "—"}</p>
              )}
            </CardContent>
          </Card>

          <Card size="sm">
            <CardContent>
              <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase"><T k="common.status" /></p>
              {canEdit ? <StatusForm incident={incident} /> : <p className="text-sm">{incident.status}</p>}
            </CardContent>
          </Card>
        </div>

        {/* Right: photos — stretches to match the left column's height (grid row stretch),
            and the photo tiles are flex-1 rather than aspect-square so 2 photos always share
            exactly that height instead of growing past it. */}
        <Card size="sm" className="flex h-full flex-col">
          <CardContent className="flex flex-1 min-h-0 flex-col gap-3">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              <T k="incidents.detail.photos" /> ({photoDocs.length}/{MAX_INCIDENT_PHOTOS})
            </p>
            {canUpload && <AttachmentUploadForm incidentId={incident.id} />}
            {photoDocs.length > 0 && (
              <div className="flex flex-1 min-h-0 flex-col gap-3">
                {photoDocs.map((doc) => (
                  <div key={doc.id} className="group relative min-h-0 flex-1 overflow-hidden rounded-lg border">
                    {/* absolutely positioned so the image's own intrinsic size never leaks into
                        this tile's flex sizing — otherwise the browser sizes the tile to the
                        square photo's natural height before the stretch-to-match-left-column
                        pass ever runs, and min-h-0/flex-1 above have no effect. */}
                    <a href={`/api/documents/${doc.id}`} target="_blank" rel="noopener noreferrer" className="absolute inset-0 block">
                      <img src={`/api/documents/${doc.id}`} alt={doc.fileName} className="size-full object-cover" />
                    </a>
                    {canDeleteDoc && (
                      <form action={deleteIncidentAttachmentAction} className="absolute top-1.5 right-1.5">
                        <input type="hidden" name="documentId" value={doc.id} />
                        <input type="hidden" name="incidentId" value={incident.id} />
                        <Button
                          type="submit"
                          size="icon"
                          variant="secondary"
                          className="size-7 opacity-0 transition-opacity group-hover:opacity-100"
                          title={t(locale, "common.delete")}
                        >
                          <X className="size-4" />
                        </Button>
                      </form>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
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
