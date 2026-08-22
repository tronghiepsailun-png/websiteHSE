"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { createWorkPlanDocumentAction, type CreateDocumentState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useT } from "@/lib/i18n/locale-context";

/** Creates the first (or an additional) plan document — used both as the toolbar's "new
 *  document" action and as the empty-state prompt when no document exists yet. */
export function NewDocumentPrompt() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<CreateDocumentState, FormData>(createWorkPlanDocumentAction, undefined);

  return (
    <Dialog open={open} onOpenChange={setOpen} disablePointerDismissal>
      <DialogTrigger
        render={
          <Button type="button" variant="outline" size="sm">
            <Plus className="size-4" />
            {t("workplan.newDocument.button")}
          </Button>
        }
      />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("workplan.newDocument.title")}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>{t("workplan.newDocument.nameLabel")}</Label>
            <Input name="name" placeholder={t("workplan.newDocument.namePlaceholder")} required />
          </div>
          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? t("common.saving") : t("workplan.new.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
