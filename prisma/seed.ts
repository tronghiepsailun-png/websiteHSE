// Seeds two demo tenants — Organization A and Organization B — with independent
// structures, categories, severities, users and sample incidents/CAPA.
// ALL data created here is TEST DATA, never a real company. See MULTI_TENANT.md.
//
// Run with: node prisma/seed.ts  (invoked automatically by `prisma migrate dev`)

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import bcrypt from "bcryptjs";

const adapter = new PrismaLibSql({ url: process.env.DATABASE_URL ?? "file:./dev.db" });
const prisma = new PrismaClient({ adapter });

const DEMO_PASSWORD = "Password123!"; // TEST DATA credential, printed at the end for convenience

// Simplified to exactly 2 account tiers going forward — Admin (full access) and User
// (view-only), reusing the pre-existing `org_admin`/`viewer` role keys under new labels
// rather than adding new rows. The 4 other legacy role keys (hse_manager,
// department_manager, hse_staff, department_user) are no longer seeded/offered here, but
// their rows and any existing demo-org assignments are left alone in the database —
// upsert-based seeding never deletes, so this is non-destructive.
const ROLE_DEFS = [
  { key: "org_admin", name: "Admin", description: "Full access: view, create, edit, delete, import/export, manage users & configuration" },
  { key: "viewer", name: "User", description: "Read-only access across every module" },
] as const;

const PERMISSION_DEFS = [
  { key: "organization.view", module: "organization", description: "View organization info" },
  { key: "organization.manage", module: "organization", description: "Manage organization structure & settings" },
  { key: "user.manage", module: "organization", description: "Invite users and assign roles within the organization" },
  { key: "config.manage", module: "configuration", description: "Manage categories, severities, ID formats, picklists" },
  { key: "employee.view", module: "employee", description: "View employees" },
  { key: "employee.manage", module: "employee", description: "Create/edit employees" },
  { key: "incident.view", module: "incident", description: "View incidents" },
  { key: "incident.create", module: "incident", description: "Report new incidents" },
  { key: "incident.edit", module: "incident", description: "Edit incidents" },
  { key: "incident.delete", module: "incident", description: "Delete incidents" },
  { key: "capa.view", module: "capa", description: "View CAPA items" },
  { key: "capa.create", module: "capa", description: "Create CAPA items" },
  { key: "capa.edit", module: "capa", description: "Edit CAPA items" },
  { key: "capa.approve", module: "capa", description: "Approve CAPA items" },
  { key: "capa.close", module: "capa", description: "Close CAPA items" },
  { key: "document.upload", module: "document", description: "Upload attachments" },
  { key: "document.delete", module: "document", description: "Delete attachments" },
  { key: "records.view", module: "records", description: "View compliance records (PCCC, ...)" },
  { key: "records.manage", module: "records", description: "Add/update compliance record versions and manage the standard-record catalog" },
  { key: "violation.view", module: "violation", description: "View safety-officer violation log and subsidy report" },
  { key: "violation.manage", module: "violation", description: "Log violations and manage the safety-officer roster/violation-type catalog" },
  { key: "workplan.view", module: "workplan", description: "View the HSE work-plan tracker" },
  { key: "workplan.manage", module: "workplan", description: "Create/edit/delete work-plan items" },
] as const;

const ROLE_PERMISSIONS: Record<string, string[]> = {
  viewer: ["organization.view", "employee.view", "incident.view", "capa.view", "records.view", "violation.view", "workplan.view"],
  org_admin: ["organization.view", "organization.manage", "user.manage", "config.manage", "employee.view", "employee.manage", "incident.view", "incident.create", "incident.edit", "incident.delete", "capa.view", "capa.create", "capa.edit", "capa.approve", "capa.close", "document.upload", "document.delete", "records.view", "records.manage", "violation.view", "violation.manage", "workplan.view", "workplan.manage"],
};

async function seedRolesAndPermissions() {
  const roles = new Map<string, string>();
  for (const r of ROLE_DEFS) {
    const role = await prisma.role.upsert({
      where: { key: r.key },
      update: { name: r.name, description: r.description },
      create: r,
    });
    roles.set(r.key, role.id);
  }

  const permissions = new Map<string, string>();
  for (const p of PERMISSION_DEFS) {
    const perm = await prisma.permission.upsert({
      where: { key: p.key },
      update: { module: p.module, description: p.description },
      create: p,
    });
    permissions.set(p.key, perm.id);
  }

  for (const [roleKey, permKeys] of Object.entries(ROLE_PERMISSIONS)) {
    const roleId = roles.get(roleKey)!;
    for (const permKey of permKeys) {
      const permissionId = permissions.get(permKey)!;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId } },
        update: {},
        create: { roleId, permissionId },
      });
    }
  }

  return roles;
}

type OrgUnitPlan = { code: string; name: string; typeCode: string; parentCode?: string };

async function seedOrganization(opts: {
  code: string;
  name: string;
  industry: string;
  unitTypes: { code: string; name: string; level: number }[];
  units: OrgUnitPlan[];
  categories: { code: string; name: string; description: string }[];
  severities: { code: string; name: string; rank: number; colorHex: string }[];
  idPrefix: string;
  idSeparator: string;
  employees: { code: string; name: string; position: string; shift: string; unitCode: string }[];
}) {
  const org = await prisma.organization.upsert({
    where: { code: opts.code },
    update: { name: opts.name, industry: opts.industry },
    create: {
      code: opts.code,
      name: opts.name,
      industry: opts.industry,
      settings: { demo: true },
    },
  });

  const unitTypeIds = new Map<string, string>();
  for (const t of opts.unitTypes) {
    const ut = await prisma.orgUnitType.upsert({
      where: { organizationId_code: { organizationId: org.id, code: t.code } },
      update: { name: t.name, level: t.level },
      create: { organizationId: org.id, code: t.code, name: t.name, level: t.level },
    });
    unitTypeIds.set(t.code, ut.id);
  }

  const unitIds = new Map<string, string>();
  for (const u of opts.units) {
    const unit = await prisma.orgUnit.upsert({
      where: { organizationId_code: { organizationId: org.id, code: u.code } },
      update: {
        name: u.name,
        unitTypeId: unitTypeIds.get(u.typeCode)!,
        parentId: u.parentCode ? unitIds.get(u.parentCode) : null,
      },
      create: {
        organizationId: org.id,
        code: u.code,
        name: u.name,
        unitTypeId: unitTypeIds.get(u.typeCode)!,
        parentId: u.parentCode ? unitIds.get(u.parentCode) : null,
      },
    });
    unitIds.set(u.code, unit.id);
  }

  const categoryIds = new Map<string, string>();
  for (const c of opts.categories) {
    const cat = await prisma.incidentCategory.upsert({
      where: { organizationId_code: { organizationId: org.id, code: c.code } },
      update: { name: c.name, description: c.description },
      create: { organizationId: org.id, code: c.code, name: c.name, description: c.description },
    });
    categoryIds.set(c.code, cat.id);
  }

  const severityIds = new Map<string, string>();
  for (const s of opts.severities) {
    const sev = await prisma.incidentSeverity.upsert({
      where: { organizationId_code: { organizationId: org.id, code: s.code } },
      update: { name: s.name, rank: s.rank, colorHex: s.colorHex },
      create: { organizationId: org.id, code: s.code, name: s.name, rank: s.rank, colorHex: s.colorHex },
    });
    severityIds.set(s.code, sev.id);
  }

  await prisma.idSequenceConfig.upsert({
    where: { organizationId_module: { organizationId: org.id, module: "incident" } },
    update: {},
    create: {
      organizationId: org.id,
      module: "incident",
      prefix: opts.idPrefix,
      separator: opts.idSeparator,
      includeYear: true,
      includeOrgCode: false,
      padLength: 4,
      resetPeriod: "yearly",
      currentPeriodKey: "2026",
      currentSequence: 0,
    },
  });

  const employeeIds = new Map<string, string>();
  for (const e of opts.employees) {
    const emp = await prisma.employee.upsert({
      where: { organizationId_employeeCode: { organizationId: org.id, employeeCode: e.code } },
      update: { fullName: e.name, position: e.position, shift: e.shift, orgUnitId: unitIds.get(e.unitCode) },
      create: {
        organizationId: org.id,
        employeeCode: e.code,
        fullName: e.name,
        position: e.position,
        shift: e.shift,
        orgUnitId: unitIds.get(e.unitCode),
      },
    });
    employeeIds.set(e.code, emp.id);
  }

  return { org, unitIds, categoryIds, severityIds, employeeIds };
}

async function nextIncidentNumber(organizationId: string) {
  const cfg = await prisma.idSequenceConfig.findUniqueOrThrow({
    where: { organizationId_module: { organizationId, module: "incident" } },
  });
  const nextSeq = cfg.currentSequence + 1;
  await prisma.idSequenceConfig.update({
    where: { id: cfg.id },
    data: { currentSequence: nextSeq },
  });
  const seqStr = String(nextSeq).padStart(cfg.padLength, "0");
  return [cfg.prefix, "INC", cfg.currentPeriodKey, seqStr].filter(Boolean).join(cfg.separator);
}

async function seedIncidentsAndCapa(
  ctx: Awaited<ReturnType<typeof seedOrganization>>,
  plans: {
    unitCode: string;
    categoryCode: string;
    severityCode: string;
    employeeCode: string;
    description: string;
    status: string;
    daysAgo: number;
    withCapa?: { action: string; dueInDays: number; status: string };
  }[]
) {
  for (const p of plans) {
    const occurredAt = new Date(Date.now() - p.daysAgo * 24 * 60 * 60 * 1000);
    const employee = await prisma.employee.findUniqueOrThrow({ where: { id: ctx.employeeIds.get(p.employeeCode)! } });
    const incidentNumber = await nextIncidentNumber(ctx.org.id);

    const incident = await prisma.incident.create({
      data: {
        organizationId: ctx.org.id,
        incidentNumber,
        occurredAt,
        orgUnitId: ctx.unitIds.get(p.unitCode),
        categoryId: ctx.categoryIds.get(p.categoryCode)!,
        severityId: ctx.severityIds.get(p.severityCode)!,
        employeeId: employee.id,
        employeeNameSnapshot: employee.fullName,
        employeeCodeSnapshot: employee.employeeCode,
        positionSnapshot: employee.position,
        shiftSnapshot: employee.shift,
        description: `[TEST DATA] ${p.description}`,
        status: p.status,
      },
    });

    if (p.withCapa) {
      await prisma.capaItem.create({
        data: {
          organizationId: ctx.org.id,
          sourceModule: "incident",
          sourceRecordId: incident.id,
          action: `[TEST DATA] ${p.withCapa.action}`,
          responsiblePersonId: employee.id,
          dueDate: new Date(Date.now() + p.withCapa.dueInDays * 24 * 60 * 60 * 1000),
          status: p.withCapa.status,
        },
      });
    }
  }
}

async function seedUser(email: string, name: string, isPlatformAdmin = false) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  return prisma.user.upsert({
    where: { email },
    update: { name, isPlatformAdmin },
    create: { email, name, passwordHash, isPlatformAdmin },
  });
}

async function assignRole(userId: string, organizationId: string, roleId: string) {
  await prisma.userOrganization.upsert({
    where: { userId_organizationId: { userId, organizationId } },
    update: {},
    create: { userId, organizationId },
  });
  await prisma.userOrganizationRole.upsert({
    where: { userId_organizationId_roleId: { userId, organizationId, roleId } },
    update: {},
    create: { userId, organizationId, roleId },
  });
}

async function main() {
  console.log("Seeding roles & permissions...");
  const roleIds = await seedRolesAndPermissions();

  console.log("Seeding Organization A (manufacturing demo)...");
  const orgA = await seedOrganization({
    code: "ORG-A",
    name: "Organization A",
    industry: "manufacturing",
    unitTypes: [
      { code: "SITE", name: "Site", level: 0 },
      { code: "DEPT", name: "Department", level: 1 },
    ],
    units: [
      { code: "A-SITE-1", name: "Site 1", typeCode: "SITE" },
      { code: "A-DEPT-PROD", name: "Production Department", typeCode: "DEPT", parentCode: "A-SITE-1" },
      { code: "A-DEPT-MAINT", name: "Maintenance Department", typeCode: "DEPT", parentCode: "A-SITE-1" },
    ],
    categories: [
      { code: "MACHINERY", name: "Machinery", description: "Machinery-related incidents" },
      { code: "ELECTRICAL", name: "Electrical", description: "Electrical hazards" },
      { code: "FIRE", name: "Fire", description: "Fire-related incidents" },
      { code: "CHEMICAL", name: "Chemical", description: "Chemical exposure/spill" },
      { code: "FALL", name: "Fall", description: "Slips, trips and falls" },
      { code: "OTHER", name: "Other", description: "Uncategorized" },
    ],
    // Colors ramp green -> amber -> orange -> red across ascending rank (HSE semantic scale).
    severities: [
      { code: "A1", name: "A1 - Fatality", rank: 6, colorHex: "#ef4444" },
      { code: "A2", name: "A2 - Serious Injury", rank: 5, colorHex: "#f56028" },
      { code: "B", name: "B - Lost Time Injury", rank: 4, colorHex: "#f98219" },
      { code: "C", name: "C - Medical Treatment", rank: 3, colorHex: "#fbb021" },
      { code: "D", name: "D - First Aid", rank: 2, colorHex: "#a4c13b" },
      { code: "E", name: "E - Near Miss", rank: 1, colorHex: "#22c55e" },
    ],
    idPrefix: "ORGA",
    idSeparator: "/",
    employees: [
      { code: "A-EMP-001", name: "Employee A-01", position: "Machine Operator", shift: "Day", unitCode: "A-DEPT-PROD" },
      { code: "A-EMP-002", name: "Employee A-02", position: "Maintenance Technician", shift: "Night", unitCode: "A-DEPT-MAINT" },
      { code: "A-EMP-003", name: "Employee A-03", position: "Line Supervisor", shift: "Day", unitCode: "A-DEPT-PROD" },
    ],
  });

  console.log("Seeding Organization B (logistics demo, deliberately different structure)...");
  const orgB = await seedOrganization({
    code: "ORG-B",
    name: "Organization B",
    industry: "warehouse_logistics",
    unitTypes: [
      { code: "FACILITY", name: "Facility", level: 0 },
      { code: "ZONE", name: "Zone", level: 1 },
    ],
    units: [
      { code: "B-FAC-1", name: "Facility 1", typeCode: "FACILITY" },
      { code: "B-ZONE-INBOUND", name: "Inbound Zone", typeCode: "ZONE", parentCode: "B-FAC-1" },
      { code: "B-ZONE-OUTBOUND", name: "Outbound Zone", typeCode: "ZONE", parentCode: "B-FAC-1" },
    ],
    categories: [
      { code: "VEHICLE", name: "Vehicle / Forklift", description: "Vehicle and forklift incidents" },
      { code: "SLIP_TRIP", name: "Slip / Trip", description: "Slips and trips" },
      { code: "ERGONOMIC", name: "Ergonomic", description: "Manual handling / ergonomic strain" },
      { code: "SECURITY", name: "Security", description: "Security-related incidents" },
      { code: "OTHER", name: "Other", description: "Uncategorized" },
    ],
    // Colors ramp green -> amber -> orange -> red across ascending rank (HSE semantic scale).
    severities: [
      { code: "CRITICAL", name: "Critical", rank: 4, colorHex: "#ef4444" },
      { code: "HIGH", name: "High", rank: 3, colorHex: "#f97316" },
      { code: "MEDIUM", name: "Medium", rank: 2, colorHex: "#fbbf24" },
      { code: "LOW", name: "Low", rank: 1, colorHex: "#22c55e" },
    ],
    idPrefix: "ORGB",
    idSeparator: "-",
    employees: [
      { code: "B-EMP-001", name: "Employee B-01", position: "Forklift Driver", shift: "Day", unitCode: "B-ZONE-INBOUND" },
      { code: "B-EMP-002", name: "Employee B-02", position: "Warehouse Associate", shift: "Day", unitCode: "B-ZONE-OUTBOUND" },
    ],
  });

  console.log("Seeding incidents & CAPA...");
  await seedIncidentsAndCapa(orgA, [
    { unitCode: "A-DEPT-PROD", categoryCode: "MACHINERY", severityCode: "C", employeeCode: "A-EMP-001", description: "Hand caught near conveyor guard, minor injury.", status: "closed", daysAgo: 40, withCapa: { action: "Install additional guarding on conveyor infeed.", dueInDays: -10, status: "completed" } },
    { unitCode: "A-DEPT-MAINT", categoryCode: "ELECTRICAL", severityCode: "D", employeeCode: "A-EMP-002", description: "Minor electric shock while servicing panel.", status: "closed", daysAgo: 15, withCapa: { action: "Re-brief LOTO procedure to maintenance team.", dueInDays: 5, status: "in_progress" } },
    { unitCode: "A-DEPT-PROD", categoryCode: "FALL", severityCode: "E", employeeCode: "A-EMP-003", description: "Near-miss slip on wet floor near washdown area.", status: "investigating", daysAgo: 3 },
    { unitCode: "A-DEPT-PROD", categoryCode: "FIRE", severityCode: "B", employeeCode: "A-EMP-001", description: "Small electrical fire in control cabinet, extinguished quickly.", status: "investigating", daysAgo: 1, withCapa: { action: "Inspect all control cabinets for overheating risk.", dueInDays: 14, status: "open" } },
  ]);

  await seedIncidentsAndCapa(orgB, [
    { unitCode: "B-ZONE-INBOUND", categoryCode: "VEHICLE", severityCode: "HIGH", employeeCode: "B-EMP-001", description: "Forklift collided with racking, no injuries.", status: "closed", daysAgo: 20, withCapa: { action: "Repaint floor markings and add mirrors at blind corner.", dueInDays: 7, status: "in_progress" } },
    { unitCode: "B-ZONE-OUTBOUND", categoryCode: "ERGONOMIC", severityCode: "LOW", employeeCode: "B-EMP-002", description: "Reported back strain from manual lifting.", status: "closed", daysAgo: 60, withCapa: { action: "Provide manual handling refresher training.", dueInDays: -30, status: "completed" } },
    { unitCode: "B-ZONE-INBOUND", categoryCode: "SLIP_TRIP", severityCode: "MEDIUM", employeeCode: "B-EMP-001", description: "Slipped on spilled packaging material.", status: "investigating", daysAgo: 2 },
  ]);

  console.log("Seeding users...");
  const platformAdmin = await seedUser("platform.admin@example.com", "Platform Admin", true);

  const orgAdminA = await seedUser("orgadmin.a@example.com", "Org A Admin");
  await assignRole(orgAdminA.id, orgA.org.id, roleIds.get("org_admin")!);

  const viewerA = await seedUser("viewer.a@example.com", "Org A Viewer");
  await assignRole(viewerA.id, orgA.org.id, roleIds.get("viewer")!);

  const orgAdminB = await seedUser("orgadmin.b@example.com", "Org B Admin");
  await assignRole(orgAdminB.id, orgB.org.id, roleIds.get("org_admin")!);

  const staffB = await seedUser("hsestaff.b@example.com", "Org B User");
  await assignRole(staffB.id, orgB.org.id, roleIds.get("viewer")!);

  // Demonstrates the Organization Switcher: same user, different role in each org.
  const multiOrgUser = await seedUser("multiorg@example.com", "Multi-Org Admin");
  await assignRole(multiOrgUser.id, orgA.org.id, roleIds.get("org_admin")!);
  await assignRole(multiOrgUser.id, orgB.org.id, roleIds.get("viewer")!);

  console.log("\nSeed complete. All data above is TEST DATA.");
  console.log(`Demo password for every seeded user: ${DEMO_PASSWORD}\n`);
  console.log("Accounts:");
  console.log("  platform.admin@example.com   - Platform Admin (all organizations)");
  console.log("  orgadmin.a@example.com       - Organization A / Admin");
  console.log("  viewer.a@example.com         - Organization A / User");
  console.log("  orgadmin.b@example.com       - Organization B / Admin");
  console.log("  hsestaff.b@example.com       - Organization B / User");
  console.log("  multiorg@example.com         - Organization A (Admin) + Organization B (User)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
