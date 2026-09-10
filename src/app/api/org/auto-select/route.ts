import { NextResponse } from "next/server";
import { getSessionUser, listMembershipsForUser, ACTIVE_ORG_COOKIE } from "@/server/org-context";
import { prisma } from "@/lib/prisma";

/** Skips the "pick your organization" screen when the signed-in user only ever has one
 *  organization to be in — the single-company norm now that multi-tenant switching is gone.
 *  Kept as a real fallback (not hardcoded) for the rare platform-admin case, or if a second
 *  organization is ever added back later. */
export async function GET(request: Request) {
  const user = await getSessionUser();

  const orgId = user.isPlatformAdmin
    ? (await prisma.organization.findFirst({ where: { isActive: true }, orderBy: { name: "asc" } }))?.id
    : (await listMembershipsForUser(user.id))[0]?.organization.id;

  const response = NextResponse.redirect(new URL("/", request.url));
  if (orgId) {
    response.cookies.set(ACTIVE_ORG_COOKIE, orgId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
  }
  return response;
}
