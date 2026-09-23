import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getLocale } from "@/lib/i18n/get-locale.server";
import { t } from "@/lib/i18n/translate";
import { ACTIVE_ORG_COOKIE_SECURE } from "@/server/org-context";
import { LIVENESS_COOKIE } from "@/lib/device";
import { writeAuditLog } from "@/server/audit";

// Plain Route Handler instead of a Server Action: a Server Action that mutates cookies (which
// signIn() does internally) triggers Next.js's "automatically re-render the current page"
// behavior, and — behind this app's reverse-proxy deployment — that internal re-render resolves
// against the origin Next.js's own process is bound to (e.g. localhost:3000) rather than the
// public origin, sending the browser there instead. A Route Handler is a plain HTTP endpoint;
// cookies().set() here just adds a Set-Cookie header, with none of that magic.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email : "";
  const password = typeof body?.password === "string" ? body.password : "";

  try {
    await signIn("credentials", { email, password, redirect: false });
    // No maxAge/expires on purpose — see LIVENESS_COOKIE's own comment. Set here (not by
    // Auth.js itself) because signIn()'s own session cookie is deliberately long-lived and
    // there's no supported way to make that one browser-session-only without shortening
    // everyone's session length outright.
    (await cookies()).set(LIVENESS_COOKIE, "1", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: ACTIVE_ORG_COOKIE_SECURE,
    });
    // Best-effort — never let a logging failure block a successful login.
    const user = await prisma.user.update({ where: { email }, data: { lastLoginAt: new Date() } }).catch(() => null);
    if (user) {
      // Not scoped to one org yet at this point (org selection happens after login) — logged
      // once per org the account belongs to, so each org's own admin sees it in their audit
      // log, same as everyone else's activity there.
      const memberships = await prisma.userOrganization.findMany({ where: { userId: user.id }, select: { organizationId: true } });
      await Promise.all(
        memberships.map((m) =>
          writeAuditLog({ organizationId: m.organizationId, userId: user.id, module: "organization", recordType: "User", recordId: user.id, action: "login" })
        )
      ).catch(() => {});
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: t(await getLocale(), "auth.invalidCredentials") }, { status: 401 });
    }
    throw error;
  }
}
