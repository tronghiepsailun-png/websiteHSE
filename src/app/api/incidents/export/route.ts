import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAccess, withApiErrorHandling } from "@/server/api-guard";
import { PERMISSIONS } from "@/server/permissions";
import { getLocale } from "@/lib/i18n/get-locale.server";
import { t } from "@/lib/i18n/translate";
import type { DictionaryKey } from "@/lib/i18n/translate";
import { weekOfYear } from "@/lib/date";

function sourceRowValue(sourceRowData: unknown, key: string): string {
  if (!sourceRowData || typeof sourceRowData !== "object") return "";
  const value = (sourceRowData as Record<string, unknown>)[key];
  return value == null ? "" : String(value);
}

export async function GET() {
  return withApiErrorHandling(async () => {
    const ctx = await requireApiAccess(PERMISSIONS.INCIDENT_VIEW);
    const locale = await getLocale();
    const tr = (key: DictionaryKey) => t(locale, key);

    const incidents = await prisma.incident.findMany({
      where: { organizationId: ctx.organizationId },
      include: { category: true, severity: true, orgUnit: true, employee: true, responsiblePerson: true },
      orderBy: { occurredAt: "desc" },
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "HSE Management Platform";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet(tr("incidents.moduleName").slice(0, 31) || "Incidents", {
      views: [{ state: "frozen", ySplit: 1 }],
    });

    // Column order mirrors the original spreadsheet convention this platform was
    // asked to match (year/month/week/factory code first, severity before the
    // description, category near the end, notes last) — only the header *labels*
    // follow the current UI language, per the platform's translation rules.
    // A few platform-only fields (status, root cause, ...) are appended after that
    // original structure so nothing the system tracks is ever lost.
    sheet.columns = [
      { header: tr("incidents.export.year"), key: "year", width: 8 },
      { header: tr("incidents.export.month"), key: "month", width: 8 },
      { header: tr("incidents.export.week"), key: "week", width: 8 },
      { header: tr("incidents.export.factoryCode"), key: "factoryCode", width: 10 },
      { header: tr("incidents.table.number"), key: "incidentNumber", width: 22 },
      { header: tr("incidents.table.department"), key: "department", width: 20 },
      { header: tr("incidents.table.occurred"), key: "occurredAt", width: 14, style: { numFmt: "dd/mm/yyyy hh:mm" } },
      { header: tr("incidents.table.severity"), key: "severity", width: 12 },
      { header: tr("incidents.detail.description"), key: "description", width: 50, style: { alignment: { wrapText: true } } },
      { header: tr("incidents.new.fields.correctiveAction"), key: "correctiveAction", width: 30, style: { alignment: { wrapText: true } } },
      { header: tr("incidents.detail.responsiblePerson"), key: "responsiblePerson", width: 18 },
      { header: tr("incidents.table.employee"), key: "employee", width: 18 },
      { header: tr("incidents.table.location"), key: "location", width: 22 },
      { header: tr("incidents.detail.costRmb"), key: "costRmb", width: 14, style: { numFmt: "#,##0.00" } },
      { header: tr("incidents.detail.costVnd"), key: "costVnd", width: 16, style: { numFmt: "#,##0" } },
      { header: tr("incidents.detail.pointsDeducted"), key: "pointsDeducted", width: 12, style: { numFmt: "0.0" } },
      { header: tr("incidents.detail.injuredBodyPart"), key: "injuredBodyPart", width: 14 },
      { header: tr("incidents.table.category"), key: "category", width: 18 },
      { header: tr("incidents.new.fields.notes"), key: "notes", width: 30, style: { alignment: { wrapText: true } } },
      // — platform-only fields, appended after the original structure —
      { header: tr("common.status"), key: "status", width: 14 },
      { header: tr("incidents.new.fields.immediateCause"), key: "immediateCause", width: 30, style: { alignment: { wrapText: true } } },
      { header: tr("incidents.detail.rootCauseSection"), key: "rootCause", width: 30, style: { alignment: { wrapText: true } } },
      { header: tr("incidents.new.fields.preventiveAction"), key: "preventiveAction", width: 30, style: { alignment: { wrapText: true } } },
      { header: tr("incidents.detail.reportedLabel"), key: "reportedAt", width: 14, style: { numFmt: "dd/mm/yyyy hh:mm" } },
      { header: tr("incidents.detail.lastUpdated"), key: "updatedAt", width: 14, style: { numFmt: "dd/mm/yyyy hh:mm" } },
    ];
    sheet.getRow(1).font = { bold: true };

    for (const incident of incidents) {
      sheet.addRow({
        year: incident.occurredAt.getFullYear(),
        month: incident.occurredAt.getMonth() + 1,
        week: weekOfYear(incident.occurredAt),
        factoryCode: sourceRowValue(incident.sourceRowData, "工厂代码"),
        incidentNumber: incident.incidentNumber,
        department: incident.orgUnit?.name ?? incident.departmentSnapshot ?? "",
        occurredAt: incident.occurredAt,
        severity: incident.severity.name,
        description: incident.description,
        correctiveAction: incident.correctiveAction ?? "",
        responsiblePerson: incident.responsiblePerson?.fullName ?? incident.responsiblePersonNameSnapshot ?? "",
        employee: incident.employeeNameSnapshot ?? "",
        location: incident.locationDetail ?? "",
        costRmb: incident.costRmb ?? null,
        costVnd: incident.costVnd ?? incident.cost ?? null,
        pointsDeducted: incident.pointsDeducted ?? null,
        injuredBodyPart: incident.injuredBodyPart ?? "",
        category: incident.category.name,
        notes: incident.notes ?? "",
        status: t(locale, `status.incident.${incident.status}` as DictionaryKey),
        immediateCause: incident.immediateCause ?? "",
        rootCause: incident.rootCause ?? "",
        preventiveAction: incident.preventiveAction ?? "",
        reportedAt: incident.reportedAt,
        updatedAt: incident.updatedAt,
      });
    }

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    const fileDate = new Date().toISOString().slice(0, 10);
    const fileName = `incidents-${ctx.organizationId.slice(0, 6)}-${fileDate}.xlsx`;

    return new NextResponse(arrayBuffer as ArrayBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  });
}
