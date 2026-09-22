"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { resetUserPasswordAction, type ResetPasswordState } from "./actions";
import { useT } from "@/lib/i18n/locale-context";

/** There is no way to show a sub-account's *existing* password — it's stored as a one-way
 *  hash, not recoverable by anyone, including this app. Setting a brand-new one (shown in
 *  the clear while typing, same as the invite form) is the only "reset" path that exists. */
export function ResetPasswordDialog({ userId, userName }: { userId: string; userName: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ResetPasswordState, FormData>(resetUserPasswordAction, undefined);
  const t = useT();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" size="sm" variant="ghost" />}>{t("admin.users.resetPassword")}</DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("admin.users.resetPasswordTitle", { name: userName })}</DialogTitle>
        </DialogHeader>
        {state?.success ? (
          <p className="text-sm text-success">{t("admin.users.resetPasswordSuccess")}</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">{t("admin.users.resetPasswordHint")}</p>
            <form action={formAction} className="flex flex-col gap-3">
              <input type="hidden" name="userId" value={userId} />
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`reset-password-${userId}`}>{t("admin.users.newPassword")}</Label>
                <Input id={`reset-password-${userId}`} name="password" type="text" autoComplete="off" minLength={6} required />
              </div>
              {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
              <DialogFooter>
                <Button type="submit" disabled={pending}>
                  {pending ? t("common.saving") : t("admin.users.save")}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
