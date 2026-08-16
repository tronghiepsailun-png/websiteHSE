import { requireOrgPermission } from "@/server/api-guard";
import { PERMISSIONS } from "@/server/permissions";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InviteForm } from "./invite-form";
import { UsersTable } from "./users-table";
import { T } from "@/components/i18n/t";

export default async function UsersPage() {
  const ctx = await requireOrgPermission(PERMISSIONS.USER_MANAGE);

  const [roles, memberships] = await Promise.all([
    // Invite dropdown only ever offers the 2 simplified account tiers (Admin/User) —
    // legacy role rows (hse_manager, etc.) still exist for pre-existing assignments
    // but are no longer offered when inviting someone new.
    prisma.role.findMany({ where: { key: { in: ["org_admin", "viewer"] } }, orderBy: { name: "asc" } }),
    prisma.userOrganization.findMany({
      where: { organizationId: ctx.organizationId },
      include: {
        user: true,
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const roleAssignments = await prisma.userOrganizationRole.findMany({
    where: { organizationId: ctx.organizationId },
    include: { role: true },
  });

  const rolesByUser: Record<string, { assignmentId: string; roleKey: string; roleName: string }[]> = {};
  for (const a of roleAssignments) {
    const list = rolesByUser[a.userId] ?? [];
    list.push({ assignmentId: a.id, roleKey: a.role.key, roleName: a.role.name });
    rolesByUser[a.userId] = list;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold"><T k="admin.users.title" /></h1>
        <p className="text-sm text-muted-foreground">
          <T k="admin.users.subtitle" />
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle><T k="admin.users.addTitle" /></CardTitle>
          <CardDescription><T k="admin.users.addSubtitle" /></CardDescription>
        </CardHeader>
        <CardContent>
          <InviteForm roles={roles.map((r) => ({ id: r.id, key: r.key, name: r.name }))} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle><T k="admin.users.membersTitle" /></CardTitle>
        </CardHeader>
        <CardContent>
          <UsersTable
            memberships={memberships.map((m) => ({
              id: m.id,
              userId: m.userId,
              status: m.status,
              user: { name: m.user.name, email: m.user.email },
            }))}
            rolesByUser={rolesByUser}
          />
        </CardContent>
      </Card>
    </div>
  );
}
