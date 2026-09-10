"use client";

import Image from "next/image";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownToLine, ArrowUpFromLine, Warehouse } from "lucide-react";
import { createStockInAction, createStockOutAction, type TransactionFormState } from "./actions";
import { MAX_INVENTORY_TRANSACTION_PHOTOS } from "@/lib/inventory-constants";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FileInput } from "@/components/ui/file-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmployeeCombobox } from "@/components/employees/employee-combobox";
import { AdjustStockDialog } from "./adjust-stock-dialog";
import { useT } from "@/lib/i18n/locale-context";

export type InventoryItemView = {
  id: string;
  name: string;
  unit: string;
  imageUrl: string | null;
  minStockLevel: number;
  stock: number;
};

export type WorkshopOption = { id: string; name: string };

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

export function InventoryItemCard({ item, canEdit, workshops }: { item: InventoryItemView; canEdit: boolean; workshops: WorkshopOption[] }) {
  const t = useT();
  const low = item.stock < item.minStockLevel;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
      <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-md bg-white">
        {item.imageUrl ? (
          <Image src={item.imageUrl} alt={item.name} width={200} height={200} className="h-full w-full object-contain p-2" />
        ) : (
          <Warehouse className="h-10 w-10 text-muted-foreground" />
        )}
      </div>

      <div className="flex flex-col gap-1">
        <p className="line-clamp-2 text-sm font-medium">{item.name}</p>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{t("inventory.card.unit")}: {item.unit}</span>
          <span>{t("inventory.card.minLevel")}: {item.minStockLevel}</span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        {canEdit ? <AdjustStockDialog item={item} /> : <span className="text-2xl font-bold">{item.stock}</span>}
        <Badge variant={low ? "destructive" : "outline"} className={low ? undefined : "border-transparent bg-success/10 text-success"}>
          {low ? t("inventory.status.low") : t("inventory.status.sufficient")}
        </Badge>
      </div>

      {canEdit && (
        <div className="grid grid-cols-2 gap-2">
          <TransactionPopover item={item} type="in" workshops={workshops} />
          <TransactionPopover item={item} type="out" workshops={workshops} />
        </div>
      )}
    </div>
  );
}

function TransactionPopover({ item, type, workshops }: { item: InventoryItemView; type: "in" | "out"; workshops: WorkshopOption[] }) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const action = type === "in" ? createStockInAction : createStockOutAction;
  const [state, formAction, pending] = useActionState<TransactionFormState, FormData>(action, undefined);

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
          <Button type="button" variant={type === "in" ? "outline" : "outline"} size="sm" className="gap-1">
            {type === "in" ? <ArrowDownToLine className="h-3.5 w-3.5" /> : <ArrowUpFromLine className="h-3.5 w-3.5" />}
            {type === "in" ? t("inventory.action.stockIn") : t("inventory.action.stockOut")}
          </Button>
        }
      />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {type === "in" ? t("inventory.action.stockIn") : t("inventory.action.stockOut")} — {item.name}
          </DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="itemId" value={item.id} />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`qty-${type}-${item.id}`}>{t("inventory.form.quantity")}</Label>
            <Input id={`qty-${type}-${item.id}`} name="quantity" type="number" min={1} step={1} required defaultValue={1} />
          </div>

          {type === "out" && (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`dept-${item.id}`}>{t("inventory.form.department")}</Label>
                <Select name="department">
                  <SelectTrigger id={`dept-${item.id}`} className="w-full">
                    <SelectValue placeholder={t("inventory.form.departmentPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {workshops.map((w) => (
                      <SelectItem key={w.id} value={w.name}>
                        {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>{t("inventory.form.recipient")}</Label>
                <EmployeeCombobox name="recipientEmployeeId" placeholder={t("inventory.form.recipientPlaceholder")} emptyLabel={t("inventory.form.recipientEmpty")} />
              </div>
            </>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`date-${type}-${item.id}`}>{t("inventory.form.date")}</Label>
            <Input id={`date-${type}-${item.id}`} name="transactionDate" type="date" required defaultValue={todayInputValue()} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`note-${type}-${item.id}`}>{t("inventory.form.note")}</Label>
            <Textarea id={`note-${type}-${item.id}`} name="note" placeholder={t("inventory.form.notePlaceholder")} rows={2} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`photos-${type}-${item.id}`}>{t("inventory.form.photos", { max: MAX_INVENTORY_TRANSACTION_PHOTOS })}</Label>
            <FileInput id={`photos-${type}-${item.id}`} name="photos" accept="image/*" multiple />
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
