"use client";

import { useActionState, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileInput } from "@/components/ui/file-input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { importIncidentsAction, type ImportActionState } from "./import-actions";
import { useT } from "@/lib/i18n/locale-context";
import { FIELD_LABEL_KEYS } from "@/server/incident-import-shared";
import { STATUS_TEXT_CLASS } from "@/lib/status-tone";

export function ImportDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ImportActionState, FormData>(importIncidentsAction, undefined);
  const t = useT();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <Upload className="size-4" />
        {t("incidents.upload.button")}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("incidents.upload.button")}</DialogTitle>
          <DialogDescription>{t("incidents.upload.dialogDescription")}</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="import-file">{t("incidents.upload.selectFile")}</Label>
            <FileInput id="import-file" name="file" accept=".xlsx" required />
          </div>
          <Button type="submit" disabled={pending} className="self-end">
            {pending ? t("incidents.upload.uploading") : t("incidents.upload.submit")}
          </Button>
        </form>

        {state && "error" in state && <p className="text-sm text-destructive">{state.error}</p>}

        {state && "result" in state && !state.result.ok && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {state.result.headerErrors.map((e) => (
              <p key={e.column}>{t("incidents.import.headerMissingColumn", { column: t(FIELD_LABEL_KEYS[e.column]) })}</p>
            ))}
          </div>
        )}

        {state && "result" in state && state.result.ok && (
          <div className="flex flex-col gap-2 rounded-md border bg-muted/40 p-3 text-sm">
            <p className="font-medium">{t("incidents.upload.resultTitle")}</p>
            <p>{t("incidents.upload.resultTotal", { n: state.result.totalDataRows })}</p>
            <p className={STATUS_TEXT_CLASS.success}>{t("incidents.upload.resultCreated", { n: state.result.created })}</p>
            <p className={STATUS_TEXT_CLASS.warning}>{t("incidents.upload.resultDuplicates", { n: state.result.duplicates.length })}</p>
            <p className="text-destructive">{t("incidents.upload.resultErrors", { n: state.result.errors.length })}</p>

            {state.result.duplicates.length > 0 && (
              <ul className="max-h-32 list-disc overflow-y-auto pl-5 text-xs text-muted-foreground">
                {state.result.duplicates.map((d) => (
                  <li key={d.row}>{t("incidents.upload.duplicateEntry", { row: d.row, incidentNumber: d.incidentNumber })}</li>
                ))}
              </ul>
            )}

            {state.result.errors.length > 0 && (
              <ul className="max-h-32 list-disc overflow-y-auto pl-5 text-xs text-destructive">
                {state.result.errors.map((e, i) => (
                  <li key={i}>
                    {t("incidents.import.rowErrorPrefix", { row: e.row })}: {t(e.messageKey)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
