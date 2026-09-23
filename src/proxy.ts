import { auth } from "@/auth";
import { NextRequest, NextResponse, userAgent } from "next/server";

const PUBLIC_PATHS = ["/login"];
// Inventory item photos are plain public files under public/inventory (see the comment on
// saveInventoryImage in inventory/catalog/actions.ts) — served with no auth/download route by
// design. They share the "/inventory" prefix with the real (auth-required) Tồn kho page, so a
// plain prefix check can't tell them apart; only the actual filenames have an image extension.
// This has to be public specifically because Next's own image-optimization endpoint fetches
// the source file via a fresh, cookie-less internal request — without this, that fetch always
// hit the login redirect instead of the image, which one specific requested size effectively
// hid until now.
const INVENTORY_IMAGE_PATH = /^\/inventory\/[^/]+\.(png|jpe?g|webp|gif)$/i;
// Kept as literals (not imported from src/lib/device.ts) because that module also imports
// `cookies` from "next/headers", which isn't valid inside the proxy's own bundle — must match
// DEVICE_COOKIE/LIVENESS_COOKIE there exactly.
const DEVICE_COOKIE = "hse_device";
const LIVENESS_COOKIE = "hse_liveness";
// Auth.js picks whichever of these two names applies based on http vs https at the time it set
// the cookie — deleting both unconditionally is harmless (clearing an absent cookie is a no-op)
// and sidesteps having to re-derive which one it chose here.
const SESSION_COOKIE_NAMES = ["authjs.session-token", "__Secure-authjs.session-token"];

// Behind a reverse proxy, `req.nextUrl.origin` reflects the origin Next.js's own server socket
// is bound to (e.g. localhost:3000) rather than the public origin the browser is actually on —
// so an absolute redirect built from it sends the browser to the internal address instead of
// back out through the proxy. Forwarded headers (set by nginx) carry the real public origin.
function publicOrigin(req: NextRequest) {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
  const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
  return `${proto}://${host}`;
}

function setDeviceCookie(req: NextRequest, response: NextResponse) {
  // Real phones get a distinct mobile-optimized shell (see MobileShell), tablets stay on the
  // desktop layout since they have the screen real estate for it. Read back via
  // isMobileDevice() (src/lib/device.ts) — set on every response, not just page navigations,
  // so it's never stale by the time a Server Component reads it.
  const { device } = userAgent(req);
  response.cookies.set(DEVICE_COOKIE, device.type === "mobile" ? "mobile" : "desktop", {
    path: "/",
    sameSite: "lax",
  });
  return response;
}

function isPublicPath(pathname: string) {
  return (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/api/auth") ||
    pathname === "/api/login" ||
    INVENTORY_IMAGE_PATH.test(pathname)
  );
}

const wrappedAuth = auth((req) => {
  const { pathname } = req.nextUrl;
  const isPublic = isPublicPath(pathname);
  const origin = publicOrigin(req);

  let response: NextResponse;
  if (!req.auth && !isPublic) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    response = NextResponse.redirect(loginUrl);
  } else if (req.auth && pathname === "/login") {
    response = NextResponse.redirect(new URL("/", origin));
  } else {
    response = NextResponse.next();
  }

  return setDeviceCookie(req, response);
});

export default async function proxy(req: NextRequest, event: Parameters<typeof wrappedAuth>[1]) {
  // Auth.js's own session cookie is deliberately long-lived (see src/auth.ts) so on its own it
  // survives a full browser restart — exactly what a shared/public computer must not do.
  // LIVENESS_COOKIE is a true session cookie (no maxAge), set once at login by /api/login: if a
  // session-token cookie is present without this marker, the browser was fully closed and
  // reopened since the last real login, so the session is stale and must not be honored.
  //
  // This has to be decided and handled *before* handing the request to Auth.js's own `auth()`
  // wrapper below: that wrapper reads the incoming session-token on every request and, finding
  // it structurally valid, re-issues a fresh refreshed copy of the very same cookie on its way
  // out — unconditionally, and after anything a route/middleware does to the response. Clearing
  // the cookie ourselves after calling `auth()` doesn't survive that: Auth.js's own Set-Cookie
  // is appended last and wins. Short-circuiting here, before `auth()` ever sees the request,
  // is the only way the deletion actually sticks.
  const hasSessionCookie = SESSION_COOKIE_NAMES.some((name) => req.cookies.has(name));
  const hasLiveness = req.cookies.has(LIVENESS_COOKIE);
  const staleSession = hasSessionCookie && !hasLiveness;

  if (staleSession) {
    const { pathname } = req.nextUrl;
    const isPublic = isPublicPath(pathname);
    let response: NextResponse;
    if (isPublic) {
      response = NextResponse.next();
    } else {
      const loginUrl = new URL("/login", publicOrigin(req));
      loginUrl.searchParams.set("callbackUrl", pathname);
      response = NextResponse.redirect(loginUrl);
    }
    for (const name of SESSION_COOKIE_NAMES) response.cookies.delete(name);
    return setDeviceCookie(req, response);
  }

  return wrappedAuth(req, event);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
