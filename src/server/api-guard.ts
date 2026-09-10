import { NextResponse } from "next/server";
import { requireOrgContext, type OrgContext } from "@/server/org-context";
import { requirePermission } from "@/server/rbac";
import { ApiError, ForbiddenError } from "@/server/errors";

/** Resolves tenant + permission for an API route handler in one call. Throws ApiError on failure. */
export async function requireApiAccess(permissionKey: string | null): Promise<OrgContext> {
  const ctx = await requireOrgContext();
  if (permissionKey) {
    await requirePermission(ctx.userId, ctx.organizationId, ctx.isPlatformAdmin, permissionKey);
  }
  return ctx;
}

/** Same resolution, for use inside Server Actions (forms) rather than route handlers. */
export const requireOrgPermission = requireApiAccess;

export type PageAccessResult = OrgContext | { denied: true };

/** Every module's nav entry is always visible (see nav.ts), so a page reached without the
 *  right permission is an expected, friendly outcome — not an error. Use this instead of
 *  requireApiAccess at the top of a page.tsx, then render <NoPermissionState /> when denied,
 *  rather than letting a thrown ForbiddenError fall through to the generic error boundary. */
export async function tryApiAccess(permissionKey: string | null): Promise<PageAccessResult> {
  try {
    return await requireApiAccess(permissionKey);
  } catch (error) {
    if (error instanceof ForbiddenError) return { denied: true };
    throw error;
  }
}

/** Wraps an API route body, converting ApiError (and Zod-style validation errors) into JSON responses. */
export async function withApiErrorHandling(fn: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
