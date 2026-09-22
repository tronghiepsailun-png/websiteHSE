"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrgPermission } from "@/server/api-guard";
import { PERMISSIONS, ALWAYS_GRANTED_PERMISSIONS } from "@/server/permissions";
import { writeAuditLog } from "@/server/audit";
import { getLocale } from "@/lib/i18n/get-locale.server";
import { t } from "@/lib/i18n/translate";

const KNOWN_PERMISSION_KEYS = new Set<string>(Object.values(PERMISSIONS));

/** Only ever trust permission strings that actually exist in our own catalog — a client
 *  could otherwise submit arbitrary strings that don't correspond to a real Permission row
 *  (harmless since they'd just never match anything, but filtering keeps the resulting
 *  RolePermission set exactly what the matrix UI could have produced). */
function sanitizePermissions(raw: FormDataEntryValue[]): string[] {
  const set = new Set<string>(ALWAYS_GRANTED_PERMISSIONS);
  for (const value of raw) {
    const key = String(value);
    if (KNOWN_PERMISSION_KEYS.has(key)) set.add(key);
  }
  return [...set];
}

/** Creates (or reuses) a Role that holds exactly `permissionKeys`, scoped to one user so
 *  editing it later never accidentally changes another account's access. */
async function buildCustomRole(name: string, permissionKeys: string[]) {
  const permissions = await prisma.permission.findMany({ where: { key: { in: permissionKeys } } });

  const role = await prisma.role.create({
    data: { key: `custom_${randomBytes(9).toString("base64url")}`, name },
  });
  await prisma.rolePermission.createMany({
    data: permissions.map((p) => ({ roleId: role.id, permissionId: p.id })),
  });
  return role;
}

// Stored in the same `email` column the login form matches against (see note below) — kept to
// plain ASCII so it's never ambiguous to type back in at the login screen (Vietnamese diacritics
// are easy to mistype/mis-render across keyboards, and this column isn't validated as a real
// email address anyway).
const USERNAME_PATTERN = /^[a-zA-Z0-9._-]+$/;

const inviteSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(USERNAME_PATTERN),
  name: z.string().min(1).max(120),
  password: z.string().min(6).max(200),
});

export type InviteState = { error?: string } | undefined;

export async function inviteUserAction(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const ctx = await requireOrgPermission(PERMISSIONS.USER_MANAGE);
  const parsed = inviteSchema.safeParse({
    username: formData.get("username"),
    name: formData.get("name"),
    password: formData.get("password"),
  });
  const locale = await getLocale();

  if (!parsed.success) return { error: t(locale, "common.invalidInput") };

  const permissionKeys = sanitizePermissions(formData.getAll("permissions"));

  // `username` is stored in the same `email` column the login form matches against — it
  // doesn't have to actually look like an email address (the login schema only requires a
  // non-empty string), this is just reusing the existing unique identity column.
  let user = await prisma.user.findUnique({ where: { email: parsed.data.username } });

  if (!user) {
    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    user = await prisma.user.create({
      data: { email: parsed.data.username, name: parsed.data.name, passwordHash },
    });
  }

  const role = await buildCustomRole(parsed.data.name, permissionKeys);

  await prisma.userOrganization.upsert({
    where: { userId_organizationId: { userId: user.id, organizationId: ctx.organizationId } },
    update: { status: "active" },
    create: { userId: user.id, organizationId: ctx.organizationId, status: "active" },
  });

  await prisma.userOrganizationRole.create({
    data: { userId: user.id, organizationId: ctx.organizationId, roleId: role.id },
  });

  await writeAuditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    module: "organization",
    recordType: "User",
    recordId: user.id,
    action: "create",
  });

  revalidatePath("/admin/users");
  return undefined;
}

/** Replaces a sub-account's entire permission set. If their current role is shared with
 *  anyone else (a legacy org_admin/viewer assignment, or in principle any role used by more
 *  than one UserOrganizationRole row), a fresh personal role is created instead of mutating
 *  the shared one in place — otherwise editing "this one" account's permissions would
 *  silently change every other account still holding that same role. */
export async function updateUserPermissionsAction(formData: FormData) {
  const ctx = await requireOrgPermission(PERMISSIONS.USER_MANAGE);
  const userId = String(formData.get("userId") ?? "");
  const permissionKeys = sanitizePermissions(formData.getAll("permissions"));

  const membership = await prisma.userOrganization.findUnique({
    where: { userId_organizationId: { userId, organizationId: ctx.organizationId } },
    include: { user: true },
  });
  if (!membership) return;

  const existingAssignments = await prisma.userOrganizationRole.findMany({
    where: { userId, organizationId: ctx.organizationId },
    include: { role: { include: { _count: { select: { userOrganizationRoles: true } } } } },
  });

  const soleCustomRole = existingAssignments.find(
    (a) => a.role.key.startsWith("custom_") && a.role._count.userOrganizationRoles === 1
  );

  if (soleCustomRole && existingAssignments.length === 1) {
    // Safe to edit in place — nobody else holds this exact role.
    const permissions = await prisma.permission.findMany({ where: { key: { in: permissionKeys } } });
    await prisma.rolePermission.deleteMany({ where: { roleId: soleCustomRole.roleId } });
    await prisma.rolePermission.createMany({
      data: permissions.map((p) => ({ roleId: soleCustomRole.roleId, permissionId: p.id })),
    });
  } else {
    // Shared/legacy role (or more than one assignment) — fork into a new personal role.
    const role = await buildCustomRole(membership.user.name, permissionKeys);
    await prisma.userOrganizationRole.deleteMany({ where: { userId, organizationId: ctx.organizationId } });
    await prisma.userOrganizationRole.create({
      data: { userId, organizationId: ctx.organizationId, roleId: role.id },
    });
  }

  await writeAuditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    module: "organization",
    recordType: "User",
    recordId: userId,
    action: "update",
    changes: [{ field: "permissions", oldValue: null, newValue: permissionKeys.join(",") }],
  });

  revalidatePath("/admin/users");
}

const resetPasswordSchema = z.object({
  userId: z.string().min(1),
  password: z.string().min(6).max(200),
});

export type ResetPasswordState = { error?: string; success?: boolean } | undefined;

/** Sets a brand-new password for a sub-account — there is no way to recover or display their
 *  existing one (it's stored as a one-way bcrypt hash, by design), so this is the only "I
 *  forgot / need to change a sub-account's password" path available to an org admin. */
export async function resetUserPasswordAction(_prev: ResetPasswordState, formData: FormData): Promise<ResetPasswordState> {
  const ctx = await requireOrgPermission(PERMISSIONS.USER_MANAGE);
  const parsed = resetPasswordSchema.safeParse({
    userId: formData.get("userId"),
    password: formData.get("password"),
  });
  const locale = await getLocale();
  if (!parsed.success) return { error: t(locale, "common.invalidInput") };

  const membership = await prisma.userOrganization.findUnique({
    where: { userId_organizationId: { userId: parsed.data.userId, organizationId: ctx.organizationId } },
  });
  if (!membership) return { error: t(locale, "common.invalidInput") };

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  await prisma.user.update({ where: { id: parsed.data.userId }, data: { passwordHash } });

  await writeAuditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    module: "organization",
    recordType: "User",
    recordId: parsed.data.userId,
    action: "update",
    // Never write the actual password (old or new) to the audit trail.
    changes: [{ field: "password", oldValue: null, newValue: "(reset)" }],
  });

  return { success: true };
}

export async function removeRoleAction(formData: FormData) {
  const ctx = await requireOrgPermission(PERMISSIONS.USER_MANAGE);
  const assignmentId = String(formData.get("assignmentId"));

  const assignment = await prisma.userOrganizationRole.findUnique({ where: { id: assignmentId } });
  if (!assignment || assignment.organizationId !== ctx.organizationId) return;

  await prisma.userOrganizationRole.delete({ where: { id: assignmentId } });
  revalidatePath("/admin/users");
}

export async function setMembershipStatusAction(formData: FormData) {
  const ctx = await requireOrgPermission(PERMISSIONS.USER_MANAGE);
  const userId = String(formData.get("userId"));
  const status = String(formData.get("status"));

  await prisma.userOrganization.update({
    where: { userId_organizationId: { userId, organizationId: ctx.organizationId } },
    data: { status },
  });
  revalidatePath("/admin/users");
}

/** Fully revokes a sub-account's access to this organization (membership + every role
 *  assignment here) — the underlying User row is left alone (other AuditLog rows still
 *  reference it, and it's harmless with zero remaining access) so this can't be undone from
 *  the UI but never corrupts audit history either. */
export async function deleteMembershipAction(formData: FormData) {
  const ctx = await requireOrgPermission(PERMISSIONS.USER_MANAGE);
  const userId = String(formData.get("userId"));

  if (userId === ctx.userId) return; // can't remove your own access this way

  await prisma.userOrganizationRole.deleteMany({ where: { userId, organizationId: ctx.organizationId } });
  await prisma.userOrganization.delete({
    where: { userId_organizationId: { userId, organizationId: ctx.organizationId } },
  });

  await writeAuditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    module: "organization",
    recordType: "User",
    recordId: userId,
    action: "delete",
  });

  revalidatePath("/admin/users");
}
