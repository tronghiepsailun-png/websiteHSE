"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { adjustInventoryStockAction, type TransactionFormState } from "./actions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/locale-context";
import type { InventoryItemView } from "./item-card";

export function AdjustStockDialog({ item }: { item: InventoryItemView }) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<TransactionFormState, FormData>(adjustInventoryStockAction, undefined);

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
          <button type="button" className="text-2xl font-bold underline decoration-dotted underline-offset-4 hover:text-primary">
            {item.stock}
          </button>
        }
      />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {t("inventory.adjust.title")} — {item.name}
          </DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="itemId" value={item.id} />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`adjust-qty-${item.id}`}>{t("inventory.adjust.actualQuantity")}</Label>
            <Input id={`adjust-qty-${item.id}`} name="actualQuantity" type="number" min={0} step={1} required defaultValue={item.stock} />
            <p className="text-xs text-muted-foreground">{t("inventory.adjust.currentHint", { n: item.stock })}</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`adjust-note-${item.id}`}>{t("inventory.form.note")}</Label>
            <Textarea id={`adjust-note-${item.id}`} name="note" placeholder={t("inventory.adjust.notePlaceholder")} rows={2} />
          </div>

          {state && "error" in state && <p className="text-xs text-destructive">{state.error}</p>}

          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? t("common.saving") : t("common.save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
