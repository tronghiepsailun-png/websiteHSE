"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { removeRoleAction, setMembershipStatusAction } from "./actions";
import { useT } from "@/lib/i18n/locale-context";
import { roleLabelKey } from "@/lib/i18n/role-label";

type RoleAssignment = { assignmentId: string; roleKey: string; roleName: string };
type Membership = { id: string; userId: string; status: string; user: { name: string; email: string } };

export function UsersTable({
  memberships,
  rolesByUser,
}: {
  memberships: Membership[];
  rolesByUser: Record<string, RoleAssignment[]>;
}) {
  const t = useT();

  return (
    <Table>
      <TableHeader>
        <TableRow className="h-11">
          <TableHead>{t("common.name")}</TableHead>
          <TableHead>{t("common.email")}</TableHead>
          <TableHead>{t("common.roles")}</TableHead>
          <TableHead>{t("common.status")}</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {memberships.map((m) => {
          const roles = rolesByUser[m.userId] ?? [];
          return (
            <TableRow key={m.id} className="h-14">
              <TableCell className="py-3 font-medium">{m.user.name}</TableCell>
              <TableCell className="py-3">{m.user.email}</TableCell>
              <TableCell className="py-3">
                <div className="flex flex-wrap gap-1">
                  {roles.map((r) => {
                    const key = roleLabelKey(r.roleKey);
                    return (
                      <form action={removeRoleAction} key={r.assignmentId}>
                        <input type="hidden" name="assignmentId" value={r.assignmentId} />
                        <button type="submit" title={t("admin.users.removeRoleTitle")}>
                          <Badge variant="outline" className="cursor-pointer hover:bg-destructive/10">
                            {key ? t(key) : r.roleName} ✕
                          </Badge>
                        </button>
                      </form>
                    );
                  })}
                  {roles.length === 0 && <span className="text-xs text-muted-foreground">{t("admin.users.noRoles")}</span>}
                </div>
              </TableCell>
              <TableCell className="py-3">
                <Badge variant={m.status === "active" ? "default" : "secondary"}>
                  {m.status === "active" ? t("common.active") : t("common.statusDisabled")}
                </Badge>
              </TableCell>
              <TableCell className="py-3">
                <form action={setMembershipStatusAction}>
                  <input type="hidden" name="userId" value={m.userId} />
                  <input type="hidden" name="status" value={m.status === "active" ? "disabled" : "active"} />
                  <Button type="submit" size="sm" variant="ghost">
                    {m.status === "active" ? t("common.disable") : t("common.reactivate")}
                  </Button>
                </form>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
