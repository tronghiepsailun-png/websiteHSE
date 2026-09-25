"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileInput } from "@/components/ui/file-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useT } from "@/lib/i18n/locale-context";
import { createFormAction, updateFormAction } from "./actions";
import type { FormDto } from "@/lib/form-files";

export type CategoryOption = { id: string; label: string };

const ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.webp,.gif";

function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

/** Add a form (files required) or edit one (files optional — anything picked is added to it). */
export function FormEditorDialog({
  open,
  onOpenChange,
  form,
  categories,
  defaultCategoryId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: FormDto | null;
  categories: CategoryOption[];
  defaultCategoryId: string | null;
}) {
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState(form?.categoryId ?? defaultCategoryId ?? "");

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!categoryId) {
      setError(t("forms.error.category"));
      return;
    }
    const data = new FormData(event.currentTarget);
    data.set("categoryId", categoryId);
    setError(null);
    startTransition(async () => {
      const result = await (form ? updateFormAction(data) : createFormAction(data));
      if ("error" in result) {
        setError(result.error);
        return;
      }
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{form ? t("forms.editor.editTitle") : t("forms.editor.addTitle")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-3">
          {form && <input type="hidden" name="id" value={form.id} />}

          <Field label={t("forms.field.category")}>
            <Select value={categoryId || undefined} onValueChange={(v) => setCategoryId(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("forms.field.categoryPlaceholder")}>
                  {() => categories.find((c) => c.id === categoryId)?.label || t("forms.field.categoryPlaceholder")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_2fr]">
            <Field label={t("forms.field.code")} htmlFor="form-code">
              <Input id="form-code" name="code" defaultValue={form?.code ?? ""} placeholder={t("forms.field.codePlaceholder")} maxLength={50} />
            </Field>
            <Field label={t("forms.field.nameVi")} htmlFor="form-name-vi">
              <Input id="form-name-vi" name="nameVi" defaultValue={form?.nameVi ?? ""} maxLength={300} required />
            </Field>
          </div>

          <Field label={t("forms.field.nameZh")} htmlFor="form-name-zh">
            <Input id="form-name-zh" name="nameZh" defaultValue={form?.nameZh ?? ""} maxLength={300} />
          </Field>

          <Field label={t("forms.field.descVi")} htmlFor="form-desc-vi">
            <Textarea id="form-desc-vi" name="descriptionVi" defaultValue={form?.descriptionVi ?? ""} rows={2} maxLength={500} />
          </Field>
          <Field label={t("forms.field.descZh")} htmlFor="form-desc-zh">
            <Textarea id="form-desc-zh" name="descriptionZh" defaultValue={form?.descriptionZh ?? ""} rows={2} maxLength={500} />
          </Field>

          <Field label={t("forms.field.files")} htmlFor="form-files">
            <FileInput id="form-files" name="files" multiple accept={ACCEPT} required={!form} className="h-9 w-full" />
            <p className="text-xs text-muted-foreground">{t("forms.field.filesHint")}</p>
          </Field>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? t("common.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
