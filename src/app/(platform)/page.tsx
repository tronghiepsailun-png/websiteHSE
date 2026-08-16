import Link from "next/link";
import { AlertTriangle, IdCard, FileCheck2 } from "lucide-react";
import { requireApiAccess } from "@/server/api-guard";
import { PERMISSIONS } from "@/server/permissions";
import { getPermissionKeysForUserInOrg } from "@/server/rbac";
import { canSee } from "@/lib/nav";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { T } from "@/components/i18n/t";
import { t } from "@/lib/i18n/translate";
import { getLocale } from "@/lib/i18n/get-locale.server";
import type { DictionaryKey } from "@/lib/i18n/translate";

export default async function DashboardPage() {
  const ctx = await requireApiAccess(null);
  const locale = await getLocale();
  const permissionKeys = ctx.isPlatformAdmin ? null : Array.from(await getPermissionKeysForUserInOrg(ctx.userId, ctx.organizationId));

  const [incidentsCount, employeesCount, pcccCount] = await Promise.all([
    prisma.incident.count({ where: { organizationId: ctx.organizationId } }),
    prisma.employee.count({ where: { organizationId: ctx.organizationId, status: "active" } }),
    prisma.recordEntry.count({ where: { organizationId: ctx.organizationId, notApplicable: false } }),
  ]);

  const cards = [
    { href: "/incidents", titleKey: "nav.incidents" as DictionaryKey, unitKey: "incidents.unitLabel" as DictionaryKey, icon: AlertTriangle, count: incidentsCount, permission: PERMISSIONS.INCIDENT_VIEW },
    { href: "/employees", titleKey: "nav.employees" as DictionaryKey, unitKey: "employees.unitLabel" as DictionaryKey, icon: IdCard, count: employeesCount, permission: PERMISSIONS.EMPLOYEE_VIEW },
    { href: "/records/pccc", titleKey: "nav.recordsPccc" as DictionaryKey, unitKey: "records.unitLabel" as DictionaryKey, icon: FileCheck2, count: pcccCount, permission: PERMISSIONS.RECORDS_VIEW },
  ].filter((c) => canSee({ href: c.href, labelKey: c.titleKey, permission: c.permission, icon: c.icon }, permissionKeys));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">
          <T k="dashboard.title" />
        </h1>
        <p className="text-sm text-muted-foreground">
          <T k="dashboard.subtitle" />
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.href}>
              <CardContent className="flex flex-col gap-4 pt-6">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{t(locale, card.titleKey)}</p>
                    <p className="text-2xl font-bold leading-none">
                      {card.count} <span className="text-sm font-normal text-muted-foreground">{t(locale, card.unitKey)}</span>
                    </p>
                  </div>
                </div>
                <Link href={card.href} className="text-sm text-primary hover:underline">
                  {t(locale, "common.viewDetails")} →
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
