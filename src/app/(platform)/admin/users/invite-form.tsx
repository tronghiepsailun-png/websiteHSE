"use client";

import { useActionState } from "react";
import { inviteUserAction, type InviteState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PermissionMatrix } from "./permission-matrix";
import { useT } from "@/lib/i18n/locale-context";

export function InviteForm() {
  const [state, formAction, pending] = useActionState<InviteState, FormData>(inviteUserAction, undefined);
  const t = useT();

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="username">{t("admin.users.username")}</Label>
          <Input id="username" name="username" placeholder={t("admin.users.usernamePlaceholder")} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">{t("common.name")}</Label>
          <Input id="name" name="name" placeholder={t("admin.users.namePlaceholder")} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">{t("admin.users.password")}</Label>
          <Input id="password" name="password" type="password" minLength={6} required />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>{t("admin.users.permissionsTitle")}</Label>
        <PermissionMatrix />
      </div>

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? t("common.creating") : t("admin.users.addUser")}
        </Button>
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
