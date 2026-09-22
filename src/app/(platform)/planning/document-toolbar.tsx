"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, ListTodo, Trash2 } from "lucide-react";
import { renameWorkPlanDocumentAction, deleteWorkPlanDocumentAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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

function DeleteDocumentButton({ id }: { id: string }) {
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      await deleteWorkPlanDocumentAction(id);
      router.push("/planning");
      router.refresh();
    });
  }

  return (
    <ConfirmDialog
      trigger={
        <Button type="button" variant="ghost" size="icon" className="size-7 text-destructive hover:text-destructive" disabled={pending} title={t("workplan.deleteDocument.title")}>
          <Trash2 className="size-3.5" />
        </Button>
      }
      description={t("workplan.deleteDocument.confirm")}
      confirmLabel={t("common.delete")}
      onConfirm={handleConfirm}
      pending={pending}
    />
  );
}

export function DocumentToolbar({
  current,
  documents,
  canDelete,
}: {
  current: DocOption;
  documents: DocOption[];
  canDelete?: boolean;
}) {
  const t = useT();
  const router = useRouter();

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600">
            <ListTodo className="size-5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold">{t("workplan.pageTitle")}</h1>
            <p className="hidden text-sm text-muted-foreground md:block">{t("workplan.pageSubtitle")}</p>
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-1.5">
            <h2 className="text-base font-medium">{current.name}</h2>
            <RenameDocumentDialog id={current.id} name={current.name} />
            {canDelete && <DeleteDocumentButton id={current.id} />}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={current.id} onValueChange={(id) => router.push(`/planning?doc=${id}`)}>
              <SelectTrigger className="w-full sm:w-56">
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
      </CardContent>
    </Card>
  );
}
