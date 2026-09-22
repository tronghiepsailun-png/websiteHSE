import { NextResponse } from "next/server";
import { getSessionUser, listMembershipsForUser, ACTIVE_ORG_COOKIE, ACTIVE_ORG_COOKIE_SECURE } from "@/server/org-context";
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

  // Behind a reverse proxy, `request.url`'s origin reflects the address Next.js's own process
  // is bound to (e.g. localhost:3000) rather than the public origin — sending the browser to
  // the internal address instead of back out through the proxy. Forwarded headers (set by
  // nginx) carry the real public origin; same fix as proxy.ts's publicOrigin().
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? new URL(request.url).host;
  const proto = request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "");
  const response = NextResponse.redirect(new URL("/", `${proto}://${host}`));
  if (orgId) {
    response.cookies.set(ACTIVE_ORG_COOKIE, orgId, {
      httpOnly: true,
      sameSite: "lax",
      secure: ACTIVE_ORG_COOKIE_SECURE,
      path: "/",
    });
  }
  return response;
}
