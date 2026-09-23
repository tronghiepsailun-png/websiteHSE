import Link from "next/link";
import { History, Plus, Pencil, Trash2, LogIn } from "lucide-react";
import { requireOrgPermission } from "@/server/api-guard";
import { PERMISSIONS } from "@/server/permissions";
import { listAuditLogForOrg, listAuditLogModules } from "@/server/audit";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { T } from "@/components/i18n/t";
import { t, type DictionaryKey } from "@/lib/i18n/translate";
import { getLocale } from "@/lib/i18n/get-locale.server";
import { cn } from "@/lib/utils";

const MODULE_LABEL: Record<string, DictionaryKey> = {
  incident: "nav.incidents",
  capa: "nav.capa",
  employee: "nav.employees",
  security: "nav.employeeSecurity",
  violation: "nav.groupViolationMgmt",
  records: "nav.recordsPccc",
  workplan: "nav.workPlan",
  inventory: "nav.inventory",
  organization: "admin.users.usersModule",
  configuration: "admin.users.configModule",
  hse_target: "nav.hseTargets",
};

const ACTION_STYLE: Record<string, { icon: typeof Plus; className: string; labelKey: DictionaryKey }> = {
  create: { icon: Plus, className: "bg-success/10 text-success", labelKey: "audit.action.create" },
  update: { icon: Pencil, className: "bg-blue-500/10 text-blue-600", labelKey: "audit.action.update" },
  delete: { icon: Trash2, className: "bg-destructive/10 text-destructive", labelKey: "audit.action.delete" },
  login: { icon: LogIn, className: "bg-slate-500/10 text-slate-600", labelKey: "audit.action.login" },
};

function fmtDateTime(d: Date) {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const MAX_VALUE_CHARS = 80;
function formatValue(raw: string | null) {
  if (!raw) return "—";
  return raw.length > MAX_VALUE_CHARS ? `${raw.slice(0, MAX_VALUE_CHARS)}…` : raw;
}

export default async function AuditLogPage({ searchParams }: PageProps<"/admin/audit-log">) {
  const ctx = await requireOrgPermission(PERMISSIONS.USER_MANAGE);
  const locale = await getLocale();
  const params = await searchParams;
  const activeModule = typeof params.module === "string" && params.module !== "" ? params.module : undefined;

  const [entries, modules] = await Promise.all([
    listAuditLogForOrg(ctx.organizationId, { module: activeModule }),
    listAuditLogModules(ctx.organizationId),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-500/10 text-slate-600">
            <History className="size-5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold">
              <T k="nav.auditLog" />
            </h1>
            <p className="hidden text-sm text-muted-foreground md:block">
              <T k="audit.pageSubtitle" />
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/admin/audit-log"
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            !activeModule ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"
          )}
        >
          {t(locale, "audit.filterAll")}
        </Link>
        {modules.map((m) => (
          <Link
            key={m}
            href={`/admin/audit-log?module=${m}`}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              activeModule === m ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"
            )}
          >
            {MODULE_LABEL[m] ? t(locale, MODULE_LABEL[m]) : m}
          </Link>
        ))}
      </div>

      <Card>
        <CardContent className="pt-6">
          {entries.length === 0 ? (
            <EmptyState message={<T k="audit.empty" />} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="h-11">
                  <TableHead><T k="audit.colWhen" /></TableHead>
                  <TableHead><T k="audit.colUser" /></TableHead>
                  <TableHead><T k="audit.colModule" /></TableHead>
                  <TableHead><T k="audit.colAction" /></TableHead>
                  <TableHead><T k="audit.colField" /></TableHead>
                  <TableHead><T k="audit.colChange" /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => {
                  const style = ACTION_STYLE[entry.action] ?? ACTION_STYLE.update;
                  const Icon = style.icon;
                  return (
                    <TableRow key={entry.id} className="h-12">
                      <TableCell className="py-2 whitespace-nowrap text-muted-foreground">{fmtDateTime(entry.createdAt)}</TableCell>
                      <TableCell className="py-2 font-medium">{entry.userName ?? t(locale, "audit.unknownUser")}</TableCell>
                      <TableCell className="py-2">{MODULE_LABEL[entry.module] ? t(locale, MODULE_LABEL[entry.module]) : entry.module}</TableCell>
                      <TableCell className="py-2">
                        <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", style.className)}>
                          <Icon className="size-3" />
                          {t(locale, style.labelKey)}
                        </span>
                      </TableCell>
                      <TableCell className="py-2 text-muted-foreground">{entry.fieldName ?? "—"}</TableCell>
                      <TableCell className="py-2 text-xs break-words text-muted-foreground">
                        {entry.fieldName ? (
                          <>
                            <span className="line-through">{formatValue(entry.oldValue)}</span> → <span className="text-foreground">{formatValue(entry.newValue)}</span>
                          </>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
