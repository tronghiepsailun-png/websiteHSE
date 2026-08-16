"use client";

import { useActionState } from "react";
import { createOrganizationAction, type CreateOrgState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/lib/i18n/locale-context";

export function CreateOrgForm() {
  const [state, formAction, pending] = useActionState<CreateOrgState, FormData>(createOrganizationAction, undefined);
  const t = useT();

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr_1.5fr_auto] sm:items-end">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">{t("common.name")}</Label>
        <Input id="name" name="name" placeholder="Organization C" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="code">{t("common.code")}</Label>
        <Input id="code" name="code" placeholder="ORG-C" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="industry">{t("admin.platformOrgs.industry")}</Label>
        <Input id="industry" name="industry" placeholder={t("admin.platformOrgs.industryPlaceholder")} />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? t("common.creating") : t("admin.platformOrgs.createButton")}
      </Button>
      {state?.error && <p className="col-span-full text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
