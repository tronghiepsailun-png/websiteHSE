import { requireApiAccess } from "@/server/api-guard";
import { PERMISSIONS } from "@/server/permissions";
import { getRecordCatalog, listSites } from "@/server/records-catalog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { T } from "@/components/i18n/t";
import { getLocale } from "@/lib/i18n/get-locale.server";
import { t } from "@/lib/i18n/translate";
import { toggleRecordTypeActiveAction, applyRecordTypeToSitesAction } from "./actions";
import { TypeForm } from "./type-form";
import { STATUS_BANNER_CLASS } from "@/lib/status-tone";

export default async function RecordsCatalogPage({ searchParams }: PageProps<"/records/pccc/catalog">) {
  const ctx = await requireApiAccess(PERMISSIONS.RECORDS_MANAGE);
  const locale = await getLocale();
  const params = await searchParams;
  const applied = typeof params.applied === "string" ? Number(params.applied) : null;

  const [domain, sites] = await Promise.all([getRecordCatalog(ctx.organizationId, "PCCC"), listSites(ctx.organizationId)]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">
          <T k="records.catalog.title" />
        </h1>
        <p className="text-sm text-muted-foreground">
          <T k="records.catalog.subtitle" />
        </p>
      </div>

      {applied != null && (
        <p className={`rounded-md border px-3 py-2 text-sm ${STATUS_BANNER_CLASS.success}`}>
          {t(locale, "records.catalog.applyResult", { n: applied })}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            <T k="records.catalog.addType" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TypeForm groups={domain.groups.map((g) => ({ id: g.id, code: g.code, name: g.name }))} />
        </CardContent>
      </Card>

      {domain.groups.map((group) => (
        <Card key={group.id}>
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              {group.code} · {group.name}
            </CardTitle>
            <CardDescription>{group.types.length}</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Table>
              <TableHeader>
                <TableRow className="h-11">
                  <TableHead>{t(locale, "records.catalog.fields.code")}</TableHead>
                  <TableHead>{t(locale, "records.catalog.fields.name")}</TableHead>
                  <TableHead>{t(locale, "records.catalog.fields.cycleMonths")}</TableHead>
                  <TableHead>{t(locale, "records.catalog.fields.responsibleUnit")}</TableHead>
                  <TableHead><T k="common.status" /></TableHead>
                  <TableHead>{t(locale, "records.catalog.applyToSites")}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.types.map((rt) => (
                  <TableRow key={rt.id} className="h-14">
                    <TableCell className="py-3 font-medium">{rt.code}</TableCell>
                    <TableCell className="py-3">{rt.name}</TableCell>
                    <TableCell className="py-3">{rt.cycleMonths ?? <T k="records.detail.cycleNone" />}</TableCell>
                    <TableCell className="py-3 text-muted-foreground">{rt.responsibleUnit ?? "—"}</TableCell>
                    <TableCell className="py-3">
                      <Badge variant={rt.isActive ? "default" : "secondary"}>
                        {rt.isActive ? <T k="common.active" /> : <T k="records.catalog.inactiveBadge" />}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3">
                      <form action={applyRecordTypeToSitesAction} className="flex flex-wrap items-center gap-2">
                        <input type="hidden" name="recordTypeId" value={rt.id} />
                        {sites.map((s) => (
                          <label key={s.id} className="flex items-center gap-1 text-xs text-muted-foreground">
                            <input type="checkbox" name="orgUnitIds" value={s.id} defaultChecked />
                            {s.name}
                          </label>
                        ))}
                        <Button type="submit" size="sm" variant="outline">
                          <T k="records.catalog.applyToSites" />
                        </Button>
                      </form>
                    </TableCell>
                    <TableCell className="py-3">
                      <form action={toggleRecordTypeActiveAction}>
                        <input type="hidden" name="id" value={rt.id} />
                        <input type="hidden" name="isActive" value={(!rt.isActive).toString()} />
                        <Button type="submit" size="sm" variant="ghost">
                          {rt.isActive ? <T k="records.catalog.hide" /> : <T k="records.catalog.unhide" />}
                        </Button>
                      </form>
                    </TableCell>
                  </TableRow>
                ))}
                {group.types.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <EmptyState message={t(locale, "records.table.noResults")} />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
