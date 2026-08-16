import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/server/errors";

export async function getPermissionKeysForUserInOrg(userId: string, organizationId: string): Promise<Set<string>> {
  const assignments = await prisma.userOrganizationRole.findMany({
    where: { userId, organizationId },
    include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
  });

  const keys = new Set<string>();
  for (const assignment of assignments) {
    for (const rolePermission of assignment.role.rolePermissions) {
      keys.add(rolePermission.permission.key);
    }
  }
  return keys;
}

/**
 * Server-side permission gate. Platform Admins bypass org-scoped permission checks
 * entirely. Every mutating API route and server action must call this — hiding a
 * button in the UI is cosmetic only, this is the real gate (see RBAC.md).
 */
export async function requirePermission(
  userId: string,
  organizationId: string,
  isPlatformAdmin: boolean,
  permissionKey: string
) {
  if (isPlatformAdmin) return;
  const keys = await getPermissionKeysForUserInOrg(userId, organizationId);
  if (!keys.has(permissionKey)) {
    throw new ForbiddenError(`Missing permission: ${permissionKey}`);
  }
}
