"use client";

import { useState } from "react";
import { useActionState } from "react";
import { inviteUserAction, type InviteState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PermissionMatrix } from "./permission-matrix";
import { useT } from "@/lib/i18n/locale-context";

/** Strips Vietnamese diacritics (and anything else outside the login-safe charset) as the admin
 *  types, rather than only rejecting it on submit — matches the ASCII-only USERNAME_PATTERN
 *  enforced server-side in actions.ts. */
function toLoginSafeUsername(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^a-zA-Z0-9._-]/g, "");
}

export function InviteForm() {
  const [state, formAction, pending] = useActionState<InviteState, FormData>(inviteUserAction, undefined);
  const [username, setUsername] = useState("");
  const t = useT();

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="username">{t("admin.users.username")}</Label>
          <Input
            id="username"
            name="username"
            value={username}
            onChange={(e) => setUsername(toLoginSafeUsername(e.target.value))}
            placeholder={t("admin.users.usernamePlaceholder")}
            required
          />
          <p className="text-xs text-muted-foreground">{t("admin.users.usernameHint")}</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">{t("common.name")}</Label>
          <Input id="name" name="name" placeholder={t("admin.users.namePlaceholder")} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">{t("admin.users.password")}</Label>
          <Input id="password" name="password" type="text" autoComplete="off" minLength={6} required />
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
