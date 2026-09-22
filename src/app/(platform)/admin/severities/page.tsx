import Link from "next/link";
import { requireOrgPermission } from "@/server/api-guard";
import { PERMISSIONS } from "@/server/permissions";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createIncidentSeverityAction, toggleIncidentSeverityActiveAction } from "./actions";
import { T } from "@/components/i18n/t";
import { getLocale } from "@/lib/i18n/get-locale.server";
import { t } from "@/lib/i18n/translate";

export default async function IncidentSeveritiesPage() {
  const ctx = await requireOrgPermission(PERMISSIONS.CONFIG_MANAGE);
  const locale = await getLocale();
  const severities = await prisma.incidentSeverity.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: { rank: "desc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/settings" className="text-sm text-muted-foreground hover:underline">
          ← <T k="settings.title" />
        </Link>
        <h1 className="text-xl font-semibold"><T k="admin.severities.title" /></h1>
        <p className="hidden text-sm text-muted-foreground md:block">
          <T k="admin.severities.subtitle" />
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle><T k="admin.severities.addTitle" /></CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form action={createIncidentSeverityAction} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1.5fr_90px_110px_auto] sm:items-end">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="code"><T k="common.code" /></Label>
              <Input id="code" name="code" placeholder="HIGH" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name"><T k="common.name" /></Label>
              <Input id="name" name="name" placeholder={t(locale, "admin.severities.namePlaceholder")} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rank"><T k="common.rank" /></Label>
              <Input id="rank" name="rank" type="number" min={1} defaultValue={1} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="colorHex"><T k="common.color" /></Label>
              <Input id="colorHex" name="colorHex" type="color" defaultValue="#b45309" className="h-9 p-1" />
            </div>
            <Button type="submit"><T k="admin.severities.addTitle" /></Button>
          </form>

          <Table>
            <TableHeader>
              <TableRow className="h-11">
                <TableHead><T k="common.rank" /></TableHead>
                <TableHead><T k="common.code" /></TableHead>
                <TableHead><T k="common.name" /></TableHead>
                <TableHead><T k="common.status" /></TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {severities.map((s) => (
                <TableRow key={s.id} className="h-14">
                  <TableCell className="py-3">{s.rank}</TableCell>
                  <TableCell className="py-3">{s.code}</TableCell>
                  <TableCell className="py-3 font-medium">
                    <span className="inline-flex items-center gap-2">
                      {s.colorHex && <span className="size-2.5 rounded-full" style={{ backgroundColor: s.colorHex }} />}
                      {s.name}
                    </span>
                  </TableCell>
                  <TableCell className="py-3">
                    <Badge variant={s.isActive ? "default" : "secondary"}>
                      {s.isActive ? <T k="common.active" /> : <T k="common.inactive" />}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-3">
                    <form action={toggleIncidentSeverityActiveAction}>
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="isActive" value={(!s.isActive).toString()} />
                      <Button type="submit" size="sm" variant="ghost">
                        {s.isActive ? <T k="common.deactivate" /> : <T k="common.activate" />}
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
