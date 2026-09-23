"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { updateRecordEntryStatusAction } from "./entry-actions";
import { useT } from "@/lib/i18n/locale-context";

export function EditEntryStatusDialog({ entryId, responsiblePerson }: { entryId: string; responsiblePerson: string | null }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const t = useT();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" variant="ghost" size="sm" />}>
        <Pencil className="size-3.5" />
        {t("common.edit")}
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("records.detail.editStatusTitle")}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{t("records.detail.editStatusHint")}</p>
        <form
          action={async (formData) => {
            await updateRecordEntryStatusAction(formData);
            router.refresh();
            setOpen(false);
          }}
          className="flex flex-col gap-3"
        >
          <input type="hidden" name="entryId" value={entryId} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="responsiblePerson">{t("records.detail.responsiblePerson")}</Label>
            <Input id="responsiblePerson" name="responsiblePerson" defaultValue={responsiblePerson ?? ""} />
          </div>
          <DialogFooter>
            <Button type="submit">{t("admin.users.save")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
