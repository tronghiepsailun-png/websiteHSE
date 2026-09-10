"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { PermissionMatrix } from "./permission-matrix";
import { updateUserPermissionsAction } from "./actions";
import { useT } from "@/lib/i18n/locale-context";

export function EditPermissionsDialog({
  userId,
  userName,
  currentPermissions,
}: {
  userId: string;
  userName: string;
  currentPermissions: string[];
}) {
  const [open, setOpen] = useState(false);
  const t = useT();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" size="sm" variant="outline" />}>
        {t("admin.users.editPermissions")}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] w-fit max-w-[min(56rem,90vw)] overflow-y-auto sm:max-w-[min(56rem,90vw)]">
        <DialogHeader>
          <DialogTitle>{t("admin.users.editPermissionsTitle", { name: userName })}</DialogTitle>
        </DialogHeader>
        <form
          action={async (formData) => {
            await updateUserPermissionsAction(formData);
            setOpen(false);
          }}
          className="flex flex-col gap-4"
        >
          <input type="hidden" name="userId" value={userId} />
          <PermissionMatrix defaultSelected={currentPermissions} />
          <DialogFooter>
            <Button type="submit">{t("admin.users.save")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
