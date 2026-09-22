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
import { createSafety5sViolationContentAction, toggleSafety5sViolationContentActiveAction } from "./actions";

export default async function Safety5sCatalogPage() {
  const ctx = await requireOrgPermission(PERMISSIONS.VIOLATION_EDIT);
  const locale = await getLocale();

  const contents = await prisma.safety5sViolationContent.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/violations/5s" className="text-sm text-muted-foreground hover:underline">
          ← <T k="nav.violations5s" />
        </Link>
        <h1 className="text-xl font-semibold"><T k="violations5s.catalog.title" /></h1>
        <p className="hidden text-sm text-muted-foreground md:block"><T k="violations5s.catalog.subtitle" /></p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle><T k="violations5s.catalog.contentsTitle" /></CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form action={createSafety5sViolationContentAction} className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_2fr_auto] sm:items-end">
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
              {contents.map((c) => (
                <TableRow key={c.id} className="h-14">
                  <TableCell className="py-3 font-medium">{c.labelVi}</TableCell>
                  <TableCell className="py-3 text-muted-foreground">{c.labelZh ?? "—"}</TableCell>
                  <TableCell className="py-3">
                    <Badge variant={c.isActive ? "default" : "secondary"}>
                      {c.isActive ? <T k="common.active" /> : <T k="common.inactive" />}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-3">
                    <form action={toggleSafety5sViolationContentActiveAction}>
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
