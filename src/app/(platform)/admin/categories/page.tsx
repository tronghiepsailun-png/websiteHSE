import Link from "next/link";
import { requireOrgPermission } from "@/server/api-guard";
import { PERMISSIONS } from "@/server/permissions";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createIncidentCategoryAction, toggleIncidentCategoryActiveAction } from "./actions";
import { T } from "@/components/i18n/t";
import { getLocale } from "@/lib/i18n/get-locale.server";
import { t } from "@/lib/i18n/translate";

export default async function IncidentCategoriesPage() {
  const ctx = await requireOrgPermission(PERMISSIONS.CONFIG_MANAGE);
  const locale = await getLocale();
  const categories = await prisma.incidentCategory.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/settings" className="text-sm text-muted-foreground hover:underline">
          ← <T k="settings.title" />
        </Link>
        <h1 className="text-xl font-semibold"><T k="admin.categories.title" /></h1>
        <p className="hidden text-sm text-muted-foreground md:block">
          <T k="admin.categories.subtitle" />
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle><T k="admin.categories.addTitle" /></CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form action={createIncidentCategoryAction} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1.5fr_2fr_auto] sm:items-end">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="code"><T k="common.code" /></Label>
              <Input id="code" name="code" placeholder="MACHINERY" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name"><T k="common.name" /></Label>
              <Input id="name" name="name" placeholder={t(locale, "admin.categories.namePlaceholder")} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="description"><T k="admin.categories.descriptionOptional" /></Label>
              <Input id="description" name="description" placeholder={t(locale, "admin.categories.descriptionExample")} />
            </div>
            <Button type="submit"><T k="admin.categories.addTitle" /></Button>
          </form>

          <Table>
            <TableHeader>
              <TableRow className="h-11">
                <TableHead><T k="common.code" /></TableHead>
                <TableHead><T k="common.name" /></TableHead>
                <TableHead><T k="common.description" /></TableHead>
                <TableHead><T k="common.status" /></TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((c) => (
                <TableRow key={c.id} className="h-14">
                  <TableCell className="py-3">{c.code}</TableCell>
                  <TableCell className="py-3 font-medium">{c.name}</TableCell>
                  <TableCell className="py-3 text-muted-foreground">{c.description ?? "—"}</TableCell>
                  <TableCell className="py-3">
                    <Badge variant={c.isActive ? "default" : "secondary"}>
                      {c.isActive ? <T k="common.active" /> : <T k="common.inactive" />}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-3">
                    <form action={toggleIncidentCategoryActiveAction}>
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="isActive" value={(!c.isActive).toString()} />
                      <Button type="submit" size="sm" variant="ghost">
                        {c.isActive ? <T k="common.deactivate" /> : <T k="common.activate" />}
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
