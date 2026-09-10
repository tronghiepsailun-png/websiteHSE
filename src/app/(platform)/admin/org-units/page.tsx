import { requireOrgPermission } from "@/server/api-guard";
import { PERMISSIONS } from "@/server/permissions";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createOrgUnitTypeAction, toggleOrgUnitActiveAction } from "./actions";
import { AddUnitForm } from "./add-unit-form";
import { T } from "@/components/i18n/t";
import { getLocale } from "@/lib/i18n/get-locale.server";
import { t } from "@/lib/i18n/translate";
import type { DictionaryKey } from "@/lib/i18n/translate";

// Fixed, app-level fact (not per-org configurable): which modules actually read each unit
// type. Shown as a caption so this page is self-explanatory instead of just a bare table.
const UNIT_TYPE_USAGE_KEY: Record<string, DictionaryKey> = {
  DEPT: "admin.orgUnits.usageDept",
  SITE: "admin.orgUnits.usageSite",
};

export default async function OrgUnitsPage() {
  const ctx = await requireOrgPermission(PERMISSIONS.CONFIG_MANAGE);
  const locale = await getLocale();

  const [unitTypes, units] = await Promise.all([
    prisma.orgUnitType.findMany({ where: { organizationId: ctx.organizationId }, orderBy: { level: "asc" } }),
    prisma.orgUnit.findMany({
      where: { organizationId: ctx.organizationId },
      include: { unitType: true, parent: true },
      orderBy: { code: "asc" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold"><T k="admin.orgUnits.title" /></h1>
        <p className="text-sm text-muted-foreground">
          <T k="admin.orgUnits.subtitle" />
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle><T k="admin.orgUnits.unitTypesTitle" /></CardTitle>
          <CardDescription><T k="admin.orgUnits.unitTypesDescription" /></CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form action={createOrgUnitTypeAction} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_2fr_100px_auto] sm:items-end">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ut-code"><T k="common.code" /></Label>
              <Input id="ut-code" name="code" placeholder="SITE" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ut-name"><T k="common.name" /></Label>
              <Input id="ut-name" name="name" placeholder={t(locale, "admin.orgUnits.unitTypeNamePlaceholder")} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ut-level"><T k="common.level" /></Label>
              <Input id="ut-level" name="level" type="number" min={0} defaultValue={0} required />
            </div>
            <Button type="submit"><T k="admin.orgUnits.addType" /></Button>
          </form>

          <Table>
            <TableHeader>
              <TableRow className="h-11">
                <TableHead><T k="common.name" /></TableHead>
                <TableHead><T k="common.code" /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {unitTypes.map((ut) => {
                const usageKey = UNIT_TYPE_USAGE_KEY[ut.code];
                return (
                  <TableRow key={ut.id} className="h-14">
                    <TableCell className="py-3">
                      <p className="font-medium">{ut.name}</p>
                      {usageKey && <p className="text-xs text-muted-foreground"><T k={usageKey} /></p>}
                    </TableCell>
                    <TableCell className="py-3 text-muted-foreground">{ut.code}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle><T k="admin.orgUnits.unitsTitle" /></CardTitle>
          <CardDescription><T k="admin.orgUnits.unitsDescription" /></CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {unitTypes.length === 0 ? (
            <p className="text-sm text-muted-foreground"><T k="admin.orgUnits.addTypeFirst" /></p>
          ) : (
            <AddUnitForm unitTypes={unitTypes.map((t) => ({ id: t.id, name: t.name }))} units={units.map((u) => ({ id: u.id, name: u.name }))} />
          )}

          <Table>
            <TableHeader>
              <TableRow className="h-11">
                <TableHead><T k="common.code" /></TableHead>
                <TableHead><T k="common.name" /></TableHead>
                <TableHead><T k="common.type" /></TableHead>
                <TableHead><T k="common.parent" /></TableHead>
                <TableHead><T k="common.status" /></TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {units.map((u) => (
                <TableRow key={u.id} className="h-14">
                  <TableCell className="py-3">{u.code}</TableCell>
                  <TableCell className="py-3 font-medium">{u.name}</TableCell>
                  <TableCell className="py-3">{u.unitType.name}</TableCell>
                  <TableCell className="py-3">{u.parent?.name ?? "—"}</TableCell>
                  <TableCell className="py-3">
                    <Badge variant={u.isActive ? "default" : "secondary"}>
                      {u.isActive ? <T k="common.active" /> : <T k="common.inactive" />}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-3">
                    <form action={toggleOrgUnitActiveAction}>
                      <input type="hidden" name="id" value={u.id} />
                      <input type="hidden" name="isActive" value={(!u.isActive).toString()} />
                      <Button type="submit" size="sm" variant="ghost">
                        {u.isActive ? <T k="common.deactivate" /> : <T k="common.activate" />}
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
