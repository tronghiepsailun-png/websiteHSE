"use client";

import { useActionState } from "react";
import { inviteUserAction, type InviteState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useT } from "@/lib/i18n/locale-context";
import { roleLabelKey } from "@/lib/i18n/role-label";

export function InviteForm({ roles }: { roles: { id: string; key: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState<InviteState, FormData>(inviteUserAction, undefined);
  const t = useT();

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 sm:grid-cols-[1.5fr_1.5fr_1fr_auto] sm:items-end">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">{t("common.email")}</Label>
        <Input id="email" name="email" type="email" placeholder="person@example.com" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">{t("common.name")}</Label>
        <Input id="name" name="name" placeholder={t("admin.users.namePlaceholder")} required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>{t("common.role")}</Label>
        <Select name="roleId" required>
          <SelectTrigger>
            <SelectValue placeholder={t("admin.users.selectRole")}>
              {(value: string) => {
                const role = roles.find((r) => r.id === value);
                if (!role) return value;
                const key = roleLabelKey(role.key);
                return key ? t(key) : role.name;
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {roles.map((r) => {
              const key = roleLabelKey(r.key);
              return (
                <SelectItem key={r.id} value={r.id}>
                  {key ? t(key) : r.name}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? t("common.creating") : t("admin.users.addUser")}
      </Button>

      {state?.error && <p className="col-span-full text-sm text-destructive">{state.error}</p>}
      {state?.tempPassword && (
        <p className="col-span-full rounded-md bg-muted p-2 text-sm">
          {t("admin.users.tempPasswordNotice")}{" "}
          <code className="font-mono font-semibold">{state.tempPassword}</code>
        </p>
      )}
    </form>
  );
}
