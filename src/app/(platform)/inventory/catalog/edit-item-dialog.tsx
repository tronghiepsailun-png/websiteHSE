"use client";

import Image from "next/image";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { updateInventoryItemAction, type ItemFormState } from "./actions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FileInput } from "@/components/ui/file-input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { T } from "@/components/i18n/t";
import { useT } from "@/lib/i18n/locale-context";

export type CatalogItemView = {
  id: string;
  name: string;
  nameZh: string | null;
  unit: string;
  imageUrl: string | null;
  minStockLevel: number;
  isActive: boolean;
};

export function EditItemDialog({ item }: { item: CatalogItemView }) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ItemFormState, FormData>(updateInventoryItemAction, undefined);

  useEffect(() => {
    if (state && "success" in state) {
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button type="button" variant="ghost" size="sm" className="gap-1">
            <Pencil className="h-3.5 w-3.5" />
            <T k="common.edit" />
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{item.name}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="id" value={item.id} />

          <div className="flex items-center gap-3">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-white">
              {item.imageUrl && <Image src={item.imageUrl} alt={item.name} width={64} height={64} className="h-full w-full object-contain p-1" />}
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor={`edit-image-${item.id}`}>{t("inventory.catalog.fields.image")}</Label>
              <FileInput id={`edit-image-${item.id}`} name="image" accept="image/png,image/jpeg,image/webp" />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`edit-name-${item.id}`}>{t("inventory.catalog.fields.name")}</Label>
            <Input id={`edit-name-${item.id}`} name="name" defaultValue={item.name} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`edit-nameZh-${item.id}`}>{t("inventory.catalog.fields.nameZh")}</Label>
            <Input id={`edit-nameZh-${item.id}`} name="nameZh" defaultValue={item.nameZh ?? ""} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`edit-unit-${item.id}`}>{t("inventory.catalog.fields.unit")}</Label>
              <Input id={`edit-unit-${item.id}`} name="unit" defaultValue={item.unit} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`edit-min-${item.id}`}>{t("inventory.catalog.fields.minStockLevel")}</Label>
              <Input id={`edit-min-${item.id}`} name="minStockLevel" type="number" min={0} step={1} defaultValue={item.minStockLevel} required />
            </div>
          </div>

          {state && "error" in state && <p className="text-xs text-destructive">{state.error}</p>}

          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>
              {pending ? t("common.saving") : t("common.save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
