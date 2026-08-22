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
import { KPI_ITEMS } from "@/server/incident-reports";
import { AliasWorkshopSelect } from "./alias-workshop-select";
import {
  createSafetyWorkshopAction,
  toggleSafetyWorkshopActiveAction,
  saveWorkshopTargetsAction,
  saveKpiTargetsAction,
} from "./actions";

export default async function HseTargetsPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const ctx = await requireOrgPermission(PERMISSIONS.CONFIG_MANAGE);
  const locale = await getLocale();
  const params = await searchParams;
  const year = Number(params.year) || new Date().getFullYear();

  const [workshops, aliases, targets] = await Promise.all([
    prisma.safetyWorkshop.findMany({ where: { organizationId: ctx.organizationId }, orderBy: { sortOrder: "asc" } }),
    prisma.departmentAlias.findMany({ where: { organizationId: ctx.organizationId }, orderBy: { rawText: "asc" } }),
    prisma.hseYearlyTarget.findMany({ where: { organizationId: ctx.organizationId, year: { in: [year - 1, year] } } }),
  ]);

  const targetValue = (safetyWorkshopId: string | null, y: number, metricKey: string) =>
    targets.find((t) => t.safetyWorkshopId === safetyWorkshopId && t.year === y && t.metricKey === metricKey)?.value ?? "";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">
          <T k="admin.hseTargets.title" />
        </h1>
        <p className="text-sm text-muted-foreground">
          <T k="admin.hseTargets.subtitle" />
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            <T k="admin.hseTargets.workshopsTitle" />
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form
            action={createSafetyWorkshopAction}
            className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_2fr_1.5fr_100px_90px_auto] sm:items-end"
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="code">
                <T k="common.code" />
              </Label>
              <Input id="code" name="code" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">
                <T k="common.name" />
              </Label>
              <Input id="name" name="name" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="groupName">
                <T k="admin.hseTargets.groupName" />
              </Label>
              <Input id="groupName" name="groupName" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="safetyCategory">
                <T k="incidents.report.deduction.safetyCategory" />
              </Label>
              <Input id="safetyCategory" name="safetyCategory" placeholder="1类" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sortOrder">
                <T k="admin.hseTargets.sortOrder" />
              </Label>
              <Input id="sortOrder" name="sortOrder" type="number" min={0} defaultValue={workshops.length + 1} required />
            </div>
            <Button type="submit">
              <T k="admin.hseTargets.addWorkshop" />
            </Button>
          </form>

          <Table>
            <TableHeader>
              <TableRow className="h-11">
                <TableHead><T k="admin.hseTargets.sortOrder" /></TableHead>
                <TableHead><T k="admin.hseTargets.groupName" /></TableHead>
                <TableHead><T k="common.name" /></TableHead>
                <TableHead><T k="incidents.report.deduction.safetyCategory" /></TableHead>
                <TableHead><T k="common.status" /></TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {workshops.map((w) => (
                <TableRow key={w.id} className="h-12">
                  <TableCell className="py-2">{w.sortOrder}</TableCell>
                  <TableCell className="py-2 text-muted-foreground">{w.groupName}</TableCell>
                  <TableCell className="py-2 font-medium">{w.name}</TableCell>
                  <TableCell className="py-2 text-muted-foreground">{w.safetyCategory ?? "—"}</TableCell>
                  <TableCell className="py-2">
                    <Badge variant={w.isActive ? "default" : "secondary"}>
                      {w.isActive ? <T k="common.active" /> : <T k="common.inactive" />}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-2">
                    <form action={toggleSafetyWorkshopActiveAction}>
                      <input type="hidden" name="id" value={w.id} />
                      <input type="hidden" name="isActive" value={(!w.isActive).toString()} />
                      <Button type="submit" size="sm" variant="ghost">
                        {w.isActive ? <T k="common.deactivate" /> : <T k="common.activate" />}
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
            <T k="admin.hseTargets.aliasesTitle" />
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            <T k="admin.hseTargets.aliasesSubtitle" />
          </p>
          <Table>
            <TableHeader>
              <TableRow className="h-11">
                <TableHead><T k="admin.hseTargets.rawText" /></TableHead>
                <TableHead><T k="incidents.report.score.workshopCol" /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {aliases.map((a) => (
                <TableRow key={a.id} className="h-12">
                  <TableCell className="py-2 font-medium">
                    {a.rawText || (
                      <span className="text-muted-foreground italic">
                        <T k="admin.hseTargets.rawTextEmpty" />
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="py-2">
                    <AliasWorkshopSelect aliasId={a.id} value={a.safetyWorkshopId} workshops={workshops} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>
            <T k="admin.hseTargets.targetsTitle" />
          </CardTitle>
          <form action="/admin/hse-targets" className="flex items-center gap-2">
            <Input name="year" type="number" defaultValue={year} className="h-9 w-28" />
            <Button type="submit" size="sm" variant="outline">
              <T k="common.filter" />
            </Button>
          </form>
        </CardHeader>
        <CardContent className="flex flex-col gap-8">
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-muted-foreground">
              <T k="admin.hseTargets.deductionTargetsTitle" />
            </h3>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="h-11">
                    <TableHead className="whitespace-nowrap"><T k="incidents.report.score.workshopCol" /></TableHead>
                    <TableHead className="whitespace-nowrap"><T k="incidents.report.deduction.priorActual" /></TableHead>
                    <TableHead className="whitespace-nowrap"><T k="incidents.report.deduction.priorTarget" /></TableHead>
                    <TableHead className="whitespace-nowrap"><T k="incidents.report.deduction.currentTarget" /></TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workshops.map((w) => (
                    <TableRow key={w.id} className="h-12">
                      <TableCell className="py-2 font-medium whitespace-nowrap">{w.name}</TableCell>
                      <TableCell className="py-2" colSpan={3}>
                        <form action={saveWorkshopTargetsAction} className="flex items-center gap-2">
                          <input type="hidden" name="safetyWorkshopId" value={w.id} />
                          <input type="hidden" name="year" value={year} />
                          <Input
                            name="priorYearActual"
                            type="number"
                            step="0.1"
                            defaultValue={targetValue(w.id, year - 1, "deduction_actual")}
                            className="h-8 w-24"
                          />
                          <Input
                            name="priorYearTarget"
                            type="number"
                            step="0.1"
                            defaultValue={targetValue(w.id, year - 1, "deduction_target")}
                            className="h-8 w-24"
                          />
                          <Input
                            name="currentYearTarget"
                            type="number"
                            step="0.1"
                            defaultValue={targetValue(w.id, year, "deduction_target")}
                            className="h-8 w-24"
                          />
                          <Button type="submit" size="sm" variant="outline">
                            <T k="common.save" />
                          </Button>
                        </form>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-muted-foreground">
              <T k="admin.hseTargets.kpiTargetsTitle" />
            </h3>
            <div className="flex flex-col gap-3">
              {KPI_ITEMS.map((item) => (
                <form
                  key={item.code}
                  action={saveKpiTargetsAction}
                  className="flex flex-wrap items-center gap-2 rounded-lg border p-3"
                >
                  <input type="hidden" name="kpiCode" value={item.code} />
                  <input type="hidden" name="year" value={year} />
                  <div className="min-w-48 flex-1">
                    <div className="text-sm font-medium">{item.nameVi}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.categoryVi} · {item.unit}
                    </div>
                  </div>
                  <Input
                    name="target"
                    type="number"
                    step="0.01"
                    placeholder={t(locale, "admin.hseTargets.target")}
                    defaultValue={targetValue(null, year, `kpi_${item.code}_target`)}
                    className="h-8 w-24"
                    aria-label="target"
                  />
                  {item.source !== "manual" && (
                    <Input
                      name="actualOverride"
                      type="number"
                      step="0.01"
                      placeholder={t(locale, "admin.hseTargets.actualOverride")}
                      defaultValue={targetValue(null, year, `kpi_${item.code}_actual_override`)}
                      className="h-8 w-28"
                      aria-label="actual override"
                    />
                  )}
                  {item.source === "manual" &&
                    Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <Input
                        key={m}
                        name={`m${String(m).padStart(2, "0")}`}
                        type="number"
                        step="0.01"
                        defaultValue={targetValue(null, year, `kpi_${item.code}_m${String(m).padStart(2, "0")}`)}
                        className="h-8 w-14"
                        aria-label={`month-${m}`}
                      />
                    ))}
                  <Button type="submit" size="sm" variant="outline">
                    <T k="common.save" />
                  </Button>
                </form>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
