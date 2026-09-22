import { cookies } from "next/headers";

export const DEVICE_COOKIE = "hse_device";

// A true browser-session cookie (no maxAge/expires) set once at login (see /api/login) and
// checked on every request by proxy.ts. Auth.js's own session cookie is deliberately
// persistent (a multi-week expiry, by design — see src/auth.ts), so on its own it stays valid
// across a full browser restart, which is exactly what a shared/public factory-floor computer
// must not do. This cookie has no such expiry, so the browser drops it the moment it fully
// closes; proxy.ts treats "logged in per the JWT, but this marker is gone" as a signal to force
// a fresh login rather than silently trusting the surviving JWT.
export const LIVENESS_COOKIE = "hse_liveness";

/** Set by proxy.ts from the request's real User-Agent (see userAgent() there) — reading it
 *  back from a cookie keeps every Server Component's device check a plain call instead of
 *  re-parsing the User-Agent header everywhere it's needed. */
export async function isMobileDevice(): Promise<boolean> {
  const store = await cookies();
  return store.get(DEVICE_COOKIE)?.value === "mobile";
}
