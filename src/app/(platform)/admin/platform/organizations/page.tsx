import { notFound } from "next/navigation";
import { getSessionUser } from "@/server/org-context";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreateOrgForm } from "./create-org-form";
import { toggleOrganizationActiveAction } from "./actions";
import { T } from "@/components/i18n/t";

export default async function PlatformOrganizationsPage() {
  const user = await getSessionUser();
  if (!user.isPlatformAdmin) notFound();

  const organizations = await prisma.organization.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { userOrganizations: true, incidents: true } } },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold"><T k="nav.organizations" /></h1>
        <p className="text-sm text-muted-foreground"><T k="admin.platformOrgs.pageSubtitle" /></p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle><T k="admin.platformOrgs.createTitle" /></CardTitle>
          <CardDescription><T k="admin.platformOrgs.createSubtitle" /></CardDescription>
        </CardHeader>
        <CardContent>
          <CreateOrgForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle><T k="admin.platformOrgs.allOrgsTitle" /></CardTitle>
          <CardDescription><T k="admin.platformOrgs.allOrgsSubtitle" /></CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="h-11">
                <TableHead><T k="common.name" /></TableHead>
                <TableHead><T k="common.code" /></TableHead>
                <TableHead><T k="admin.platformOrgs.industryColumn" /></TableHead>
                <TableHead><T k="common.users" /></TableHead>
                <TableHead><T k="nav.incidents" /></TableHead>
                <TableHead><T k="common.status" /></TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {organizations.map((org) => (
                <TableRow key={org.id} className="h-14">
                  <TableCell className="py-3 font-medium">{org.name}</TableCell>
                  <TableCell className="py-3">{org.code}</TableCell>
                  <TableCell className="py-3">{org.industry ?? "—"}</TableCell>
                  <TableCell className="py-3">{org._count.userOrganizations}</TableCell>
                  <TableCell className="py-3">{org._count.incidents}</TableCell>
                  <TableCell className="py-3">
                    <Badge variant={org.isActive ? "default" : "secondary"}>
                      {org.isActive ? <T k="common.active" /> : <T k="common.inactive" />}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-3">
                    <form action={toggleOrganizationActiveAction}>
                      <input type="hidden" name="organizationId" value={org.id} />
                      <input type="hidden" name="isActive" value={(!org.isActive).toString()} />
                      <Button type="submit" size="sm" variant="ghost">
                        {org.isActive ? <T k="common.deactivate" /> : <T k="common.activate" />}
                      </Button>
                    </form>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
