"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { updateRecordTypeAction } from "../catalog/actions";
import { useT } from "@/lib/i18n/locale-context";

type RecordTypeFields = {
  id: string;
  legalBasis: string | null;
  legalBasisZh: string | null;
  frequencyLabel: string | null;
  frequencyLabelZh: string | null;
  cycleMonths: number | null;
  responsibleUnit: string | null;
  responsibleUnitZh: string | null;
};

/** Edits the shared catalog definition ("Thông tin hồ sơ chuẩn") right from the entry it's
 *  attached to — the change still applies to the whole record type, same as editing it from
 *  the catalog page, just reachable without leaving this screen. */
export function EditRecordTypeDialog({ recordType }: { recordType: RecordTypeFields }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const t = useT();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" variant="ghost" size="sm" />}>
        <Pencil className="size-3.5" />
        {t("common.edit")}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("records.detail.editCatalogInfoTitle")}</DialogTitle>
        </DialogHeader>
        <form
          action={async (formData) => {
            await updateRecordTypeAction(formData);
            router.refresh();
            setOpen(false);
          }}
          className="flex flex-col gap-3"
        >
          <input type="hidden" name="id" value={recordType.id} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="legalBasis">{t("records.catalog.fields.legalBasis")}</Label>
              <Input id="legalBasis" name="legalBasis" defaultValue={recordType.legalBasis ?? ""} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="legalBasisZh">{t("records.catalog.fields.legalBasisZh")}</Label>
              <Input id="legalBasisZh" name="legalBasisZh" defaultValue={recordType.legalBasisZh ?? ""} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="frequencyLabel">{t("records.catalog.fields.frequencyLabel")}</Label>
              <Input id="frequencyLabel" name="frequencyLabel" defaultValue={recordType.frequencyLabel ?? ""} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="frequencyLabelZh">{t("records.catalog.fields.frequencyLabelZh")}</Label>
              <Input id="frequencyLabelZh" name="frequencyLabelZh" defaultValue={recordType.frequencyLabelZh ?? ""} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cycleMonths">{t("records.catalog.fields.cycleMonths")}</Label>
              <Input id="cycleMonths" name="cycleMonths" type="number" min={0} defaultValue={recordType.cycleMonths ?? ""} />
            </div>
            <div />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="responsibleUnit">{t("records.catalog.fields.responsibleUnit")}</Label>
              <Input id="responsibleUnit" name="responsibleUnit" defaultValue={recordType.responsibleUnit ?? ""} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="responsibleUnitZh">{t("records.catalog.fields.responsibleUnitZh")}</Label>
              <Input id="responsibleUnitZh" name="responsibleUnitZh" defaultValue={recordType.responsibleUnitZh ?? ""} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{t("records.detail.editCatalogInfoHint")}</p>
          <DialogFooter>
            <Button type="submit">{t("admin.users.save")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
