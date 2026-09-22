"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { setMembershipStatusAction, deleteMembershipAction } from "./actions";
import { EditPermissionsDialog } from "./edit-permissions-dialog";
import { ResetPasswordDialog } from "./reset-password-dialog";
import { useT } from "@/lib/i18n/locale-context";
import { PERMISSION_MODULES } from "@/server/permissions";

type Membership = { id: string; userId: string; status: string; user: { name: string; email: string; lastLoginAt: Date | null } };
type TFunc = ReturnType<typeof useT>;

function fmtLastLogin(d: Date | null, t: TFunc) {
  if (!d) return t("admin.users.neverLoggedIn");
  const date = new Date(d);
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

const ACTION_COLUMNS = ["edit", "delete", "upload", "download"] as const;

function summarize(permissions: string[], t: TFunc) {
  if (permissions.length === 0) return t("admin.users.summaryNone");

  const set = new Set(permissions);
  const hasAll = (keys: string[] | null) => keys !== null && keys.every((k) => set.has(k));

  const allGranted = PERMISSION_MODULES.every((mod) => ACTION_COLUMNS.every((c) => mod[c] === null || hasAll(mod[c])));
  if (allGranted) return t("admin.users.summaryFullAccess");

  const anyGranted = PERMISSION_MODULES.some((mod) => ACTION_COLUMNS.some((c) => mod[c] !== null && hasAll(mod[c])));
  if (!anyGranted) return t("admin.users.summaryViewOnly");

  return t("admin.users.summaryCustom", { count: permissions.length });
}

export function UsersTable({
  memberships,
  permissionsByUser,
}: {
  memberships: Membership[];
  permissionsByUser: Record<string, string[]>;
}) {
  const t = useT();

  return (
    <Table>
      <TableHeader>
        <TableRow className="h-11">
          <TableHead>{t("common.name")}</TableHead>
          <TableHead>{t("admin.users.username")}</TableHead>
          <TableHead>{t("admin.users.permissionsTitle")}</TableHead>
          <TableHead>{t("common.status")}</TableHead>
          <TableHead>{t("admin.users.lastLogin")}</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {memberships.map((m) => {
          const permissions = permissionsByUser[m.userId] ?? [];
          return (
            <TableRow key={m.id} className="h-14">
              <TableCell className="py-3 font-medium">{m.user.name}</TableCell>
              <TableCell className="py-3">{m.user.email}</TableCell>
              <TableCell className="py-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{summarize(permissions, t)}</Badge>
                  <EditPermissionsDialog userId={m.userId} userName={m.user.name} currentPermissions={permissions} />
                </div>
              </TableCell>
              <TableCell className="py-3">
                <Badge variant={m.status === "active" ? "default" : "secondary"}>
                  {m.status === "active" ? t("common.active") : t("common.statusDisabled")}
                </Badge>
              </TableCell>
              <TableCell className="py-3 text-sm text-muted-foreground whitespace-nowrap">{fmtLastLogin(m.user.lastLoginAt, t)}</TableCell>
              <TableCell className="py-3">
                <div className="flex items-center gap-1">
                  <ResetPasswordDialog userId={m.userId} userName={m.user.name} />
                  <form action={setMembershipStatusAction}>
                    <input type="hidden" name="userId" value={m.userId} />
                    <input type="hidden" name="status" value={m.status === "active" ? "disabled" : "active"} />
                    <Button type="submit" size="sm" variant="ghost">
                      {m.status === "active" ? t("common.disable") : t("common.reactivate")}
                    </Button>
                  </form>
                  <ConfirmDialog
                    trigger={
                      <Button type="button" size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                        {t("admin.users.deleteMember")}
                      </Button>
                    }
                    title={t("admin.users.deleteMemberConfirmTitle")}
                    description={t("admin.users.deleteMemberConfirmDescription", { name: m.user.name })}
                    confirmLabel={t("common.delete")}
                    onConfirm={() => {
                      const formData = new FormData();
                      formData.set("userId", m.userId);
                      deleteMembershipAction(formData);
                    }}
                  />
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
