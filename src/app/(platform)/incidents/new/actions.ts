"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrgPermission } from "@/server/api-guard";
import { PERMISSIONS } from "@/server/permissions";
import { generateIncidentNumber } from "@/server/incidents";
import { writeAuditLog } from "@/server/audit";
import { getLocale } from "@/lib/i18n/get-locale.server";
import { t } from "@/lib/i18n/translate";
import { zodFieldErrors, type FieldErrors } from "@/lib/form-errors";

// Historical CCG data shows pointsDeducted is a fixed function of severity, never a freely
// assessed number (every B incident is exactly 0.1, every C exactly 0.3, every D exactly 0.5;
// A never deducts). Auto-filled below when the form field is left blank, since a reporter has
// no way to know this business rule; the form field still allows a manual override.
const DEFAULT_POINTS_DEDUCTED_BY_SEVERITY: Record<string, number> = { B: 0.1, C: 0.3, D: 0.5 };

// Form fields are type="number" client-side, but a server action can be invoked directly
// (bypassing that constraint), so a non-numeric string must not reach Prisma as NaN — a Float
// column write would throw an uncaught error instead of the intended validation message.
function toFiniteNumberOrNull(value: string | undefined): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

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

export type CreateIncidentState = { error?: string; fieldErrors?: FieldErrors } | undefined;

export async function createIncidentAction(_prev: CreateIncidentState, formData: FormData): Promise<CreateIncidentState> {
  const ctx = await requireOrgPermission(PERMISSIONS.INCIDENT_CREATE);

  const raw = Object.fromEntries(formData.entries());
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { error: t(await getLocale(), "incidents.new.errorGeneric"), fieldErrors: zodFieldErrors(parsed.error) };
  const data = parsed.data;

  // Both ids reference Employee and come straight from form fields, so each must be
  // re-checked against the caller's own org before being trusted — otherwise a stale or
  // crafted id could link another org's employee into this org's incident record.
  const referencedEmployeeIds = [data.employeeId, data.responsiblePersonId].filter((id): id is string => !!id);
  const validEmployees = referencedEmployeeIds.length
    ? await prisma.employee.findMany({
        where: { id: { in: referencedEmployeeIds }, organizationId: ctx.organizationId },
        include: { orgUnit: true },
      })
    : [];

  const employee = data.employeeId ? validEmployees.find((e) => e.id === data.employeeId) : undefined;
  const employeeId = employee?.id ?? null;
  const responsiblePersonId =
    data.responsiblePersonId && validEmployees.some((e) => e.id === data.responsiblePersonId) ? data.responsiblePersonId : null;

  let employeeSnapshot: Record<string, string | null> = {};
  if (employee) {
    employeeSnapshot = {
      employeeNameSnapshot: employee.fullName,
      employeeCodeSnapshot: employee.employeeCode,
      departmentSnapshot: employee.orgUnit?.name ?? null,
      positionSnapshot: employee.position,
      shiftSnapshot: employee.shift,
    };
  }

  // A manually-typed number lets the user keep their own numbering convention (e.g.
  // "CCG/AT{date}-{seq}") instead of the platform's auto-generated format; blank falls
  // back to the configured sequence like before.
  const incidentNumber = data.incidentNumber?.trim() || (await generateIncidentNumber(ctx.organizationId));

  let pointsDeducted = toFiniteNumberOrNull(data.pointsDeducted);
  if (pointsDeducted === null) {
    const severity = await prisma.incidentSeverity.findUnique({ where: { id: data.severityId }, select: { code: true } });
    if (severity && severity.code in DEFAULT_POINTS_DEDUCTED_BY_SEVERITY) {
      pointsDeducted = DEFAULT_POINTS_DEDUCTED_BY_SEVERITY[severity.code];
    }
  }

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
        employeeId,
        ...employeeSnapshot,
        responsiblePersonId,
        categoryId: data.categoryId,
        severityId: data.severityId,
        description: data.description,
        immediateCause: data.immediateCause || null,
        rootCause: data.rootCause || null,
        correctiveAction: data.correctiveAction || null,
        preventiveAction: data.preventiveAction || null,
        costVnd: toFiniteNumberOrNull(data.costVnd),
        costRmb: toFiniteNumberOrNull(data.costRmb),
        pointsDeducted,
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

  // Covers the whole /incidents route (list + all 5 report tabs, which are query-param
  // variants of this same page) — without this, tabs 02-05 keep showing stale aggregates
  // computed before this incident existed.
  revalidatePath("/incidents");
  redirect(`/incidents/${incident.id}`);
}
