import { cookies } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { UnauthorizedError, ForbiddenError, NotFoundError } from "@/server/errors";

export const ACTIVE_ORG_COOKIE = "hse_active_org";

export type SessionUser = { id: string; isPlatformAdmin: boolean; name?: string | null; email?: string | null };

/** Throws UnauthorizedError if there is no signed-in user. Never trust client-supplied identity beyond this. */
export async function getSessionUser(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user) throw new UnauthorizedError();
  return session.user;
}

export async function getActiveOrganizationId(): Promise<string | null> {
  const store = await cookies();
  return store.get(ACTIVE_ORG_COOKIE)?.value ?? null;
}

export async function listMembershipsForUser(userId: string) {
  return prisma.userOrganization.findMany({
    where: { userId, status: "active" },
    include: { organization: true },
    orderBy: { organization: { name: "asc" } },
  });
}

export type OrgContext = { userId: string; isPlatformAdmin: boolean; organizationId: string };

/**
 * Resolves the tenant context for the current request: who is signed in, and which
 * organization they're acting in right now. organizationId always comes from the
 * server-verified session/cookie, never from client-supplied request bodies or params —
 * that is the core multi-tenant isolation guarantee (see MULTI_TENANT.md).
 */
export async function requireOrgContext(): Promise<OrgContext> {
  const user = await getSessionUser();
  const organizationId = await getActiveOrganizationId();
  if (!organizationId) {
    throw new ForbiddenError("No active organization selected");
  }

  if (!user.isPlatformAdmin) {
    const membership = await prisma.userOrganization.findUnique({
      where: { userId_organizationId: { userId: user.id, organizationId } },
    });
    if (!membership || membership.status !== "active") {
      throw new ForbiddenError("You are not a member of this organization");
    }
  } else {
    const org = await prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) throw new ForbiddenError("Organization not found");
  }

  return { userId: user.id, isPlatformAdmin: user.isPlatformAdmin, organizationId };
}

/** Throws if the given record's organizationId doesn't match the current tenant context. */
export function assertBelongsToOrg(record: { organizationId: string } | null, organizationId: string) {
  if (!record || record.organizationId !== organizationId) {
    throw new NotFoundError();
  }
}
