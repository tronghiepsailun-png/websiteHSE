"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createInventoryItemAction, type ItemFormState } from "./actions";
import { Input } from "@/components/ui/input";
import { FileInput } from "@/components/ui/file-input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { T } from "@/components/i18n/t";
import { useT } from "@/lib/i18n/locale-context";

export function ItemForm() {
  const t = useT();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<ItemFormState, FormData>(createInventoryItemAction, undefined);
  // FileInput tracks its own "chosen file" label in React state, which form.reset() below can't
  // touch (it doesn't fire a change event) — remounting via key clears that label along with the
  // native input's own value.
  const [imageInputKey, setImageInputKey] = useState(0);

  useEffect(() => {
    if (state && "success" in state) {
      formRef.current?.reset();
      setImageInputKey((k) => k + 1);
      router.refresh();
    }
  }, [state, router]);

  return (
    <form ref={formRef} action={formAction} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <div className="flex flex-col gap-1.5 lg:col-span-2">
        <Label htmlFor="new-name">{t("inventory.catalog.fields.name")}</Label>
        <Input id="new-name" name="name" required />
      </div>
      <div className="flex flex-col gap-1.5 lg:col-span-2">
        <Label htmlFor="new-nameZh">{t("inventory.catalog.fields.nameZh")}</Label>
        <Input id="new-nameZh" name="nameZh" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="new-unit">{t("inventory.catalog.fields.unit")}</Label>
        <Input id="new-unit" name="unit" placeholder={t("inventory.catalog.fields.unitPlaceholder")} required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="new-minStockLevel">{t("inventory.catalog.fields.minStockLevel")}</Label>
        <Input id="new-minStockLevel" name="minStockLevel" type="number" min={0} step={1} defaultValue={0} required />
      </div>
      <div className="flex flex-col gap-1.5 lg:col-span-3">
        <Label htmlFor="new-image">{t("inventory.catalog.fields.image")}</Label>
        <FileInput key={imageInputKey} id="new-image" name="image" accept="image/png,image/jpeg,image/webp" />
      </div>
      <div className="flex items-end lg:col-span-5 lg:justify-between">
        {state && "error" in state && <p className="text-xs text-destructive">{state.error}</p>}
        <div className="ml-auto">
          <Button type="submit" disabled={pending}>
            {pending ? t("common.creating") : <T k="inventory.catalog.addItem" />}
          </Button>
        </div>
      </div>
    </form>
  );
}
