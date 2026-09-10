import { requireOrgPermission } from "@/server/api-guard";
import { PERMISSIONS } from "@/server/permissions";
import { getPermissionKeysForUserInOrg } from "@/server/rbac";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InviteForm } from "./invite-form";
import { UsersTable } from "./users-table";
import { T } from "@/components/i18n/t";

export default async function UsersPage() {
  const ctx = await requireOrgPermission(PERMISSIONS.USER_MANAGE);

  const memberships = await prisma.userOrganization.findMany({
    where: { organizationId: ctx.organizationId },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });

  const permissionsByUser: Record<string, string[]> = {};
  for (const m of memberships) {
    permissionsByUser[m.userId] = Array.from(await getPermissionKeysForUserInOrg(m.userId, ctx.organizationId));
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
          <InviteForm />
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
            permissionsByUser={permissionsByUser}
          />
        </CardContent>
      </Card>
    </div>
  );
}
