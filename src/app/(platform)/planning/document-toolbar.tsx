"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { renameWorkPlanDocumentAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { NewDocumentPrompt } from "./new-document-prompt";
import { useT } from "@/lib/i18n/locale-context";

type DocOption = { id: string; name: string };

function RenameDocumentDialog({ id, name }: { id: string; name: string }) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    await renameWorkPlanDocumentAction(formData);
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen} disablePointerDismissal>
      <DialogTrigger
        render={
          <Button type="button" variant="ghost" size="icon" className="size-7" title={t("workplan.renameDocument.title")}>
            <Pencil className="size-3.5" />
          </Button>
        }
      />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("workplan.renameDocument.title")}</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={handleSubmit} className="flex flex-col gap-3">
          <input type="hidden" name="id" value={id} />
          <div className="flex flex-col gap-1.5">
            <Label>{t("workplan.newDocument.nameLabel")}</Label>
            <Input name="name" defaultValue={name} required />
          </div>
          <DialogFooter>
            <Button type="submit">{t("workplan.new.submit")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DocumentToolbar({ current, documents }: { current: DocOption; documents: DocOption[] }) {
  const t = useT();
  const router = useRouter();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-1.5">
        <h1 className="text-xl font-semibold">{current.name}</h1>
        <RenameDocumentDialog id={current.id} name={current.name} />
      </div>
      <div className="flex items-center gap-2">
        <Select value={current.id} onValueChange={(id) => router.push(`/planning?doc=${id}`)}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder={t("workplan.pageTitle")}>
              {(id: string) => documents.find((d) => d.id === id)?.name ?? id}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {documents.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <NewDocumentPrompt />
      </div>
    </div>
  );
}
