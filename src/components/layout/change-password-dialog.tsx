"use client";

import { useActionState, useEffect, useState } from "react";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { changePasswordAction, type ChangePasswordState } from "@/app/(platform)/actions";
import { useT } from "@/lib/i18n/locale-context";

// Controlled (no DialogTrigger) since this is opened from a DropdownMenuItem — nesting a
// trigger there would fight the dropdown's own close-on-click behavior (same reasoning as
// ConfirmDialog's controlled mode).
export function ChangePasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useT();
  const [state, formAction, pending] = useActionState<ChangePasswordState, FormData>(changePasswordAction, undefined);
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    if (open) setFormKey((k) => k + 1); // clear fields/state each time the dialog re-opens
  }, [open]);

  useEffect(() => {
    if (state?.success) {
      const timeout = setTimeout(() => onOpenChange(false), 1200);
      return () => clearTimeout(timeout);
    }
  }, [state, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-4.5" />
            {t("auth.changePassword")}
          </DialogTitle>
        </DialogHeader>
        <form key={formKey} action={formAction} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="currentPassword">{t("auth.currentPassword")}</Label>
            <Input id="currentPassword" name="currentPassword" type="password" required autoComplete="current-password" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="newPassword">{t("auth.newPassword")}</Label>
            <Input id="newPassword" name="newPassword" type="password" minLength={6} required autoComplete="new-password" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirmPassword">{t("auth.confirmNewPassword")}</Label>
            <Input id="confirmPassword" name="confirmPassword" type="password" minLength={6} required autoComplete="new-password" />
          </div>

          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          {state?.success && <p className="text-sm text-success">{t("auth.passwordChanged")}</p>}

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? t("common.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
