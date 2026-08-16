"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrgPermission } from "@/server/api-guard";
import { PERMISSIONS } from "@/server/permissions";
import { writeAuditLog } from "@/server/audit";
import { getLocale } from "@/lib/i18n/get-locale.server";
import { t } from "@/lib/i18n/translate";

const inviteSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120),
  roleId: z.string().min(1),
});

export type InviteState = { error?: string; tempPassword?: string } | undefined;

export async function inviteUserAction(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const ctx = await requireOrgPermission(PERMISSIONS.USER_MANAGE);
  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name"),
    roleId: formData.get("roleId"),
  });
  const locale = await getLocale();

  if (!parsed.success) return { error: t(locale, "common.invalidInput") };

  const role = await prisma.role.findUnique({ where: { id: parsed.data.roleId } });
  if (!role) return { error: t(locale, "admin.users.unknownRole") };

  let user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  let tempPassword: string | undefined;

  if (!user) {
    tempPassword = randomBytes(6).toString("base64url");
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    user = await prisma.user.create({
      data: { email: parsed.data.email, name: parsed.data.name, passwordHash },
    });
  }

  await prisma.userOrganization.upsert({
    where: { userId_organizationId: { userId: user.id, organizationId: ctx.organizationId } },
    update: { status: "active" },
    create: { userId: user.id, organizationId: ctx.organizationId, status: "active" },
  });

  await prisma.userOrganizationRole.upsert({
    where: { userId_organizationId_roleId: { userId: user.id, organizationId: ctx.organizationId, roleId: role.id } },
    update: {},
    create: { userId: user.id, organizationId: ctx.organizationId, roleId: role.id },
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
  return tempPassword ? { tempPassword } : undefined;
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
