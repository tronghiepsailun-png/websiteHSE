import Link from "next/link";
import { notFound } from "next/navigation";
import { X } from "lucide-react";
import { requireApiAccess } from "@/server/api-guard";
import { PERMISSIONS } from "@/server/permissions";
import { getIncidentById, MAX_INCIDENT_PHOTOS } from "@/server/incidents";
import { NotFoundError } from "@/server/errors";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SeverityBadge, IncidentStatusBadge } from "@/components/incidents/severity-badge";
import { StatusForm } from "./status-form";
import { CorrectiveActionForm } from "./corrective-action-form";
import { AttachmentUploadForm } from "./attachment-upload-form";
import { deleteIncidentAttachmentAction } from "./actions";
import { DeleteIncidentButton } from "./delete-incident-button";
import { EmptyState } from "@/components/ui/empty-state";
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

export default async function IncidentDetailPage({ params }: PageProps<"/incidents/[id]">) {
  const ctx = await requireApiAccess(PERMISSIONS.INCIDENT_VIEW);
  const { id } = await params;
  const locale = await getLocale();

  const incident = await getIncidentById(ctx.organizationId, id).catch((error) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });
  const [employees, auditLogs, permissionKeys] = await Promise.all([
    prisma.employee.findMany({ where: { organizationId: ctx.organizationId, status: "active" }, orderBy: { fullName: "asc" } }),
    prisma.auditLog.findMany({
      where: { organizationId: ctx.organizationId, module: "incident", recordId: id },
      include: { user: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    ctx.isPlatformAdmin
      ? Promise.resolve(null)
      : prisma.userOrganizationRole
          .findMany({ where: { userId: ctx.userId, organizationId: ctx.organizationId }, include: { role: { include: { rolePermissions: { include: { permission: true } } } } } })
          .then((rows) => rows.flatMap((r) => r.role.rolePermissions.map((rp) => rp.permission.key))),
  ]);

  const canEdit = hasPermission(permissionKeys, PERMISSIONS.INCIDENT_EDIT);
  const canUpload = hasPermission(permissionKeys, PERMISSIONS.DOCUMENT_UPLOAD);
  const canDeleteDoc = hasPermission(permissionKeys, PERMISSIONS.DOCUMENT_DELETE);
  const canDeleteIncident = hasPermission(permissionKeys, PERMISSIONS.INCIDENT_DELETE);

  const photoDocs = incident.documents.filter((doc) => doc.fileType.startsWith("image/"));
  const otherDocs = incident.documents.filter((doc) => !doc.fileType.startsWith("image/"));

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      {/* 1. Overview */}
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* 4. Classification / 5. Severity / 3. Location */}
          <Card>
            <CardHeader><CardTitle className="text-base"><T k="incidents.detail.classificationLocation" /></CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              <div><p className="text-muted-foreground"><T k="incidents.table.category" /></p><p className="font-medium">{incident.category.name}</p></div>
              <div><p className="text-muted-foreground"><T k="incidents.table.severity" /></p><p className="font-medium">{incident.severity.name}</p></div>
              <div><p className="text-muted-foreground"><T k="incidents.table.occurred" /></p><p className="font-medium">{fmt(incident.occurredAt)}</p></div>
              <div><p className="text-muted-foreground"><T k="incidents.new.fields.orgUnit" /></p><p className="font-medium">{incident.orgUnit?.name ?? "—"}</p></div>
              <div><p className="text-muted-foreground"><T k="incidents.new.fields.locationDetail" /></p><p className="font-medium">{incident.locationDetail ?? "—"}</p></div>
              <div><p className="text-muted-foreground"><T k="incidents.new.fields.equipment" /></p><p className="font-medium">{incident.equipment ?? "—"}</p></div>
              <div><p className="text-muted-foreground"><T k="incidents.table.department" /></p><p className="font-medium">{incident.orgUnit?.name ?? incident.departmentSnapshot ?? "—"}</p></div>
              <div><p className="text-muted-foreground"><T k="incidents.table.cost" /></p><p className="font-medium">{formatIncidentCost(incident)}</p></div>
              <div><p className="text-muted-foreground"><T k="incidents.detail.pointsDeducted" /></p><p className="font-medium">{incident.pointsDeducted ?? "—"}</p></div>
              <div><p className="text-muted-foreground"><T k="incidents.detail.injuredBodyPart" /></p><p className="font-medium">{incident.injuredBodyPart ?? "—"}</p></div>
            </CardContent>
          </Card>

          {/* 6. Description */}
          <Card>
            <CardHeader><CardTitle className="text-base"><T k="incidents.detail.description" /></CardTitle></CardHeader>
            <CardContent className="text-sm whitespace-pre-wrap">{incident.description}</CardContent>
          </Card>

          {/* 7. Corrective action — kept visible right below the description for report screenshots */}
          <Card>
            <CardHeader><CardTitle className="text-base"><T k="incidents.new.fields.correctiveAction" /></CardTitle></CardHeader>
            <CardContent>
              {canEdit ? (
                <CorrectiveActionForm incident={incident} />
              ) : (
                <p className="text-sm whitespace-pre-wrap">{incident.correctiveAction ?? "—"}</p>
              )}
            </CardContent>
          </Card>

          {/* 8. Handling status — status / responsible person / dates only, investigation fields removed */}
          <Card>
            <CardHeader><CardTitle className="text-base"><T k="incidents.detail.statusHandling" /></CardTitle></CardHeader>
            <CardContent>
              {canEdit ? (
                <StatusForm incident={incident} employees={employees.map((e) => ({ id: e.id, name: e.fullName }))} />
              ) : (
                <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  <div><p className="text-muted-foreground"><T k="common.status" /></p><p>{incident.status}</p></div>
                  <div><p className="text-muted-foreground"><T k="incidents.detail.responsiblePerson" /></p><p>{incident.responsiblePerson?.fullName ?? "—"}</p></div>
                  <div><p className="text-muted-foreground"><T k="incidents.detail.dueDate" /></p><p>{fmt(incident.dueDate)}</p></div>
                  <div><p className="text-muted-foreground"><T k="incidents.detail.completionDate" /></p><p>{fmt(incident.completionDate)}</p></div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 10 & 11. Attachments / Photos */}
          <Card>
            <CardHeader><CardTitle className="text-base"><T k="incidents.detail.attachmentsPhotos" /></CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-4">
              {canUpload && <AttachmentUploadForm incidentId={incident.id} />}

              {photoDocs.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    <T k="incidents.detail.photos" /> ({photoDocs.length}/{MAX_INCIDENT_PHOTOS})
                  </p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {photoDocs.map((doc) => (
                      <div key={doc.id} className="group relative aspect-square overflow-hidden rounded-md border">
                        <a href={`/api/documents/${doc.id}`} target="_blank" rel="noopener noreferrer">
                          <img src={`/api/documents/${doc.id}`} alt={doc.fileName} className="size-full object-cover" />
                        </a>
                        {canDeleteDoc && (
                          <form action={deleteIncidentAttachmentAction} className="absolute top-1 right-1">
                            <input type="hidden" name="documentId" value={doc.id} />
                            <input type="hidden" name="incidentId" value={incident.id} />
                            <Button
                              type="submit"
                              size="icon"
                              variant="secondary"
                              className="size-6 opacity-0 transition-opacity group-hover:opacity-100"
                              title={t(locale, "common.delete")}
                            >
                              <X className="size-3.5" />
                            </Button>
                          </form>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {otherDocs.length > 0 && (
                <div>
                  {photoDocs.length > 0 && (
                    <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase"><T k="incidents.detail.otherAttachments" /></p>
                  )}
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
                </div>
              )}

              {incident.documents.length === 0 && <EmptyState message={<T k="incidents.detail.noAttachments" />} />}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          {/* 2. People involved */}
          <Card>
            <CardHeader><CardTitle className="text-base"><T k="incidents.detail.peopleInvolved" /></CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <div><p className="text-muted-foreground"><T k="incidents.table.employee" /></p><p className="font-medium">{incident.employeeNameSnapshot ?? "—"}</p></div>
              <div><p className="text-muted-foreground"><T k="incidents.detail.positionShift" /></p><p>{incident.positionSnapshot ?? "—"} / {incident.shiftSnapshot ?? "—"}</p></div>
              <div><p className="text-muted-foreground"><T k="incidents.detail.departmentAtTime" /></p><p>{incident.departmentSnapshot ?? "—"}</p></div>
              <div><p className="text-muted-foreground"><T k="incidents.detail.reportedBy" /></p><p>{incident.reportedBy?.name ?? "—"}</p></div>
              <div><p className="text-muted-foreground"><T k="incidents.detail.responsiblePerson" /></p><p>{incident.responsiblePerson?.fullName ?? incident.responsiblePersonNameSnapshot ?? "—"}</p></div>
            </CardContent>
          </Card>

          {/* 12. Timeline */}
          <Card>
            <CardHeader><CardTitle className="text-base"><T k="incidents.detail.timeline" /></CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground"><T k="incidents.table.occurred" /></span><span>{fmt(incident.occurredAt)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground"><T k="incidents.detail.reportedLabel" /></span><span>{fmt(incident.reportedAt)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground"><T k="incidents.detail.dueLabel" /></span><span>{fmt(incident.dueDate)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground"><T k="incidents.detail.completedLabel" /></span><span>{fmt(incident.completionDate)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground"><T k="incidents.detail.lastUpdated" /></span><span>{fmt(incident.updatedAt)}</span></div>
            </CardContent>
          </Card>

          {/* 13. Audit History */}
          <Card>
            <CardHeader><CardTitle className="text-base"><T k="incidents.detail.auditHistory" /></CardTitle></CardHeader>
            <CardContent className="flex max-h-80 flex-col gap-3 overflow-y-auto text-xs">
              {auditLogs.map((log) => (
                <div key={log.id} className="border-b pb-2 last:border-0">
                  <p>
                    <span className="font-medium">{log.user?.name ?? t(locale, "incidents.detail.system")}</span> {log.action}
                    {log.fieldName && <> · <span className="font-mono">{log.fieldName}</span></>}
                  </p>
                  {(log.oldValue || log.newValue) && (
                    <p className="text-muted-foreground">{log.oldValue ?? "—"} → {log.newValue ?? "—"}</p>
                  )}
                  <p className="text-muted-foreground">{fmt(log.createdAt)}</p>
                </div>
              ))}
              {auditLogs.length === 0 && <EmptyState message={<T k="incidents.detail.noHistory" />} className="py-4" />}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
