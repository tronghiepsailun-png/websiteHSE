"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrgPermission } from "@/server/api-guard";
import { PERMISSIONS } from "@/server/permissions";
import { generateIncidentNumber } from "@/server/incidents";
import { writeAuditLog } from "@/server/audit";
import { getLocale } from "@/lib/i18n/get-locale.server";
import { t } from "@/lib/i18n/translate";

const schema = z.object({
  incidentNumber: z.string().max(100).optional(),
  factoryCode: z.string().max(50).optional(),
  occurredAt: z.string().min(1),
  orgUnitId: z.string().optional(),
  locationDetail: z.string().max(200).optional(),
  equipment: z.string().max(200).optional(),
  employeeId: z.string().optional(),
  responsiblePersonId: z.string().optional(),
  categoryId: z.string().min(1),
  severityId: z.string().min(1),
  description: z.string().min(1),
  immediateCause: z.string().optional(),
  rootCause: z.string().optional(),
  correctiveAction: z.string().optional(),
  preventiveAction: z.string().optional(),
  costVnd: z.string().optional(),
  costRmb: z.string().optional(),
  pointsDeducted: z.string().optional(),
  injuredBodyPart: z.string().max(200).optional(),
  notes: z.string().optional(),
});

export type CreateIncidentState = { error?: string } | undefined;

export async function createIncidentAction(_prev: CreateIncidentState, formData: FormData): Promise<CreateIncidentState> {
  const ctx = await requireOrgPermission(PERMISSIONS.INCIDENT_CREATE);

  const raw = Object.fromEntries(formData.entries());
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { error: t(await getLocale(), "incidents.new.errorGeneric") };
  const data = parsed.data;

  let employeeSnapshot: Record<string, string | null> = {};
  if (data.employeeId) {
    const employee = await prisma.employee.findUnique({ where: { id: data.employeeId }, include: { orgUnit: true } });
    if (employee && employee.organizationId === ctx.organizationId) {
      employeeSnapshot = {
        employeeNameSnapshot: employee.fullName,
        employeeCodeSnapshot: employee.employeeCode,
        departmentSnapshot: employee.orgUnit?.name ?? null,
        positionSnapshot: employee.position,
        shiftSnapshot: employee.shift,
      };
    }
  }

  // A manually-typed number lets the user keep their own numbering convention (e.g.
  // "CCG/AT{date}-{seq}") instead of the platform's auto-generated format; blank falls
  // back to the configured sequence like before.
  const incidentNumber = data.incidentNumber?.trim() || (await generateIncidentNumber(ctx.organizationId));

  let incident;
  try {
    incident = await prisma.incident.create({
      data: {
        organizationId: ctx.organizationId,
        incidentNumber,
        occurredAt: new Date(data.occurredAt),
        orgUnitId: data.orgUnitId || null,
        locationDetail: data.locationDetail || null,
        equipment: data.equipment || null,
        employeeId: data.employeeId || null,
        ...employeeSnapshot,
        responsiblePersonId: data.responsiblePersonId || null,
        categoryId: data.categoryId,
        severityId: data.severityId,
        description: data.description,
        immediateCause: data.immediateCause || null,
        rootCause: data.rootCause || null,
        correctiveAction: data.correctiveAction || null,
        preventiveAction: data.preventiveAction || null,
        costVnd: data.costVnd ? Number(data.costVnd) : null,
        costRmb: data.costRmb ? Number(data.costRmb) : null,
        pointsDeducted: data.pointsDeducted ? Number(data.pointsDeducted) : null,
        injuredBodyPart: data.injuredBodyPart || null,
        // Matches the key the export route reads via sourceRowValue(..., "工厂代码"),
        // so a manually-entered incident's exported row lines up with imported ones.
        sourceRowData: data.factoryCode ? { "工厂代码": data.factoryCode } : undefined,
        notes: data.notes || null,
        reportedById: ctx.userId,
      },
    });
  } catch (err) {
    if (err instanceof Error && "code" in err && err.code === "P2002") {
      return { error: t(await getLocale(), "incidents.new.errorDuplicateNumber") };
    }
    throw err;
  }

  await writeAuditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    module: "incident",
    recordType: "Incident",
    recordId: incident.id,
    action: "create",
  });

  redirect(`/incidents/${incident.id}`);
}
