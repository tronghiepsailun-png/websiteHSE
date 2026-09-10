"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getSessionUser, ACTIVE_ORG_COOKIE } from "@/server/org-context";
import { getLocale } from "@/lib/i18n/get-locale.server";
import { t } from "@/lib/i18n/translate";

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6).max(200),
  confirmPassword: z.string().min(1),
});

export type ChangePasswordState = { error?: string; success?: true } | undefined;

/** Self-service password change — available to every account, including platform admins.
 *  Always re-checks the caller's own current password against the DB (never trust the
 *  session alone for something this sensitive), so this can't be used to hijack a different
 *  account even if userId were somehow tampered with client-side. */
export async function changePasswordAction(_prev: ChangePasswordState, formData: FormData): Promise<ChangePasswordState> {
  const sessionUser = await getSessionUser();
  const locale = await getLocale();

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return { error: t(locale, "common.invalidInput") };
  if (parsed.data.newPassword.length < 6) return { error: t(locale, "auth.passwordTooShort") };
  if (parsed.data.newPassword !== parsed.data.confirmPassword) return { error: t(locale, "auth.passwordMismatch") };

  const user = await prisma.user.findUniqueOrThrow({ where: { id: sessionUser.id } });
  const currentValid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!currentValid) return { error: t(locale, "auth.currentPasswordWrong") };

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  return { success: true };
}

/** Switches the active organization for the current session, after verifying membership. */
export async function switchOrganizationAction(formData: FormData) {
  const organizationId = String(formData.get("organizationId") ?? "");
  const user = await getSessionUser();

  if (!user.isPlatformAdmin) {
    const membership = await prisma.userOrganization.findUnique({
      where: { userId_organizationId: { userId: user.id, organizationId } },
    });
    if (!membership || membership.status !== "active") {
      throw new Error("Not a member of this organization");
    }
  } else {
    const org = await prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) throw new Error("Organization not found");
  }

  const store = await cookies();
  store.set(ACTIVE_ORG_COOKIE, organizationId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  redirect("/");
}
