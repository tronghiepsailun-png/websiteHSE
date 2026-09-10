"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { updateIssuanceTransactionAction, type TransactionFormState } from "./actions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmployeeCombobox } from "@/components/employees/employee-combobox";
import { useT } from "@/lib/i18n/locale-context";
import type { IssuanceRow } from "./issuance-table";
import type { WorkshopOption } from "./item-card";

function toDateInputValue(d: Date) {
  return new Date(d).toISOString().slice(0, 10);
}

export function EditIssuanceDialog({ row, workshops }: { row: IssuanceRow; workshops: WorkshopOption[] }) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<TransactionFormState, FormData>(updateIssuanceTransactionAction, undefined);

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
            {t("common.edit")}
          </Button>
        }
      />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {t("inventory.action.stockOut")} — {row.item.name}
          </DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="id" value={row.id} />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`edit-qty-${row.id}`}>{t("inventory.form.quantity")}</Label>
            <Input id={`edit-qty-${row.id}`} name="quantity" type="number" min={1} step={1} required defaultValue={row.quantity} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`edit-dept-${row.id}`}>{t("inventory.form.department")}</Label>
            <Select name="department" defaultValue={row.department ?? undefined}>
              <SelectTrigger id={`edit-dept-${row.id}`} className="w-full">
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
            <EmployeeCombobox
              name="recipientEmployeeId"
              placeholder={t("inventory.form.recipientPlaceholder")}
              emptyLabel={t("inventory.form.recipientEmpty")}
              defaultValue={row.recipientEmployee}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`edit-date-${row.id}`}>{t("inventory.form.date")}</Label>
            <Input id={`edit-date-${row.id}`} name="transactionDate" type="date" required defaultValue={toDateInputValue(row.transactionDate)} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`edit-note-${row.id}`}>{t("inventory.form.note")}</Label>
            <Textarea id={`edit-note-${row.id}`} name="note" defaultValue={row.note ?? ""} rows={2} />
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
