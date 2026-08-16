"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getSessionUser, ACTIVE_ORG_COOKIE } from "@/server/org-context";

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
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
