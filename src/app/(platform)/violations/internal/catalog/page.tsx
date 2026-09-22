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
import { T } from "@/components/i18n/t";
import { t } from "@/lib/i18n/translate";
import { getLocale } from "@/lib/i18n/get-locale.server";
import { AddOfficerForm } from "./add-officer-form";
import { OfficerCatalogTable } from "./officer-catalog-table";
import { createViolationTypeAction, toggleViolationTypeActiveAction } from "./actions";

export default async function ViolationCatalogPage() {
  const ctx = await requireOrgPermission(PERMISSIONS.VIOLATION_EDIT);
  const locale = await getLocale();

  const [violationTypes, officers] = await Promise.all([
    prisma.violationType.findMany({ where: { organizationId: ctx.organizationId }, orderBy: { sortOrder: "asc" } }),
    prisma.safetyOfficer.findMany({
      where: { organizationId: ctx.organizationId },
      include: { employee: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/violations/internal" className="text-sm text-muted-foreground hover:underline">
          ← <T k="violations.moduleName" />
        </Link>
        <h1 className="text-xl font-semibold"><T k="violations.catalog.title" /></h1>
        <p className="hidden text-sm text-muted-foreground md:block"><T k="violations.catalog.subtitle" /></p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle><T k="violations.catalog.typesTitle" /></CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form action={createViolationTypeAction} className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_2fr_auto] sm:items-end">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="labelVi"><T k="violations.catalog.labelVi" /></Label>
              <Input id="labelVi" name="labelVi" placeholder={t(locale, "violations.catalog.labelViPlaceholder")} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="labelZh"><T k="violations.catalog.labelZh" /></Label>
              <Input id="labelZh" name="labelZh" placeholder={t(locale, "violations.catalog.labelZhPlaceholder")} />
            </div>
            <Button type="submit"><T k="violations.catalog.addType" /></Button>
          </form>

          <Table>
            <TableHeader>
              <TableRow className="h-11">
                <TableHead><T k="violations.catalog.labelVi" /></TableHead>
                <TableHead><T k="violations.catalog.labelZh" /></TableHead>
                <TableHead><T k="common.status" /></TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {violationTypes.map((vt) => (
                <TableRow key={vt.id} className="h-14">
                  <TableCell className="py-3 font-medium">{vt.labelVi}</TableCell>
                  <TableCell className="py-3 text-muted-foreground">{vt.labelZh ?? "—"}</TableCell>
                  <TableCell className="py-3">
                    <Badge variant={vt.isActive ? "default" : "secondary"}>
                      {vt.isActive ? <T k="common.active" /> : <T k="common.inactive" />}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-3">
                    <form action={toggleViolationTypeActiveAction}>
                      <input type="hidden" name="id" value={vt.id} />
                      <input type="hidden" name="isActive" value={(!vt.isActive).toString()} />
                      <Button type="submit" size="sm" variant="ghost">
                        {vt.isActive ? <T k="common.deactivate" /> : <T k="common.activate" />}
                      </Button>
                    </form>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <T k="violations.catalog.officersTitle" /> ({officers.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <AddOfficerForm />

          <OfficerCatalogTable officers={officers} />
        </CardContent>
      </Card>
    </div>
  );
}
