"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { previewEmployeeImportAction, confirmEmployeeImportAction, type PreviewActionState } from "./import-actions";
import { useT } from "@/lib/i18n/locale-context";
import type { DictionaryKey } from "@/lib/i18n/translate";
import { FIELD_LABEL_KEYS } from "@/server/employee-import-shared";
import type { ClassifiedEmployeeRow, EmployeeImportCommitResult } from "@/server/employee-import-shared";
import { STATUS_BANNER_CLASS } from "@/lib/status-tone";

type Step = "select" | "preview" | "result";

export function ImportDialog() {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("select");
  const [state, formAction, previewPending] = useActionState<PreviewActionState, FormData>(previewEmployeeImportAction, undefined);
  const [commitResult, setCommitResult] = useState<EmployeeImportCommitResult | null>(null);
  const [confirmPending, startConfirm] = useTransition();

  const preview = state && "preview" in state ? state.preview : null;
  if (preview?.ok && step === "select") setStep("preview");

  function handleConfirm() {
    if (!preview?.ok) return;
    startConfirm(async () => {
      const result = await confirmEmployeeImportAction(
        preview.rows,
        preview.departedEmployees.map((d) => d.employeeCode)
      );
      setCommitResult(result);
      setStep("result");
    });
  }

  function handleClose(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setStep("select");
      setCommitResult(null);
      if (commitResult) router.refresh();
    }
  }

  const rowsToReview = preview?.ok ? preview.rows.filter((r) => r.status !== "existing") : [];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger render={<Button variant="outline" />}>
        <Upload className="size-4" />
        {t("employees.upload.button")}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{t("employees.upload.button")}</DialogTitle>
          <DialogDescription>
            {step === "select" && t("employees.upload.dialogDescription")}
            {step === "preview" && t("employees.upload.previewDescription")}
            {step === "result" && t("employees.upload.resultDescription")}
          </DialogDescription>
        </DialogHeader>

        {step === "select" && (
          <form action={formAction} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="import-file">{t("incidents.upload.selectFile")}</Label>
              <Input id="import-file" name="file" type="file" accept=".xlsx" required />
            </div>
            <div className="flex items-center justify-between">
              <a href="/api/employees/template" className="text-sm text-primary hover:underline">
                {t("employees.upload.downloadTemplate")}
              </a>
              <Button type="submit" disabled={previewPending}>
                {previewPending ? t("incidents.upload.uploading") : t("employees.upload.analyze")}
              </Button>
            </div>

            {state && "error" in state && <p className="text-sm text-destructive">{state.error}</p>}
            {preview && !preview.ok && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {preview.headerErrors.map((e) => (
                  <p key={e.column}>{t("incidents.import.headerMissingColumn", { column: t(FIELD_LABEL_KEYS[e.column]) })}</p>
                ))}
              </div>
            )}
          </form>
        )}

        {step === "preview" && preview?.ok && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <SummaryPill label={t("employees.upload.summaryNew")} value={preview.summary.newCount} tone="new" />
              <SummaryPill label={t("employees.upload.summaryExisting")} value={preview.summary.existingCount} tone="existing" />
              <SummaryPill label={t("employees.upload.summaryUpdated")} value={preview.summary.updatedCount} tone="updated" />
              <SummaryPill label={t("employees.upload.summaryError")} value={preview.summary.errorCount} tone="error" />
              <SummaryPill label={t("employees.upload.summaryDeparted")} value={preview.summary.departedCount} tone="departed" />
            </div>

            <div className="max-h-[45vh] overflow-y-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("employees.upload.rowColumn")}</TableHead>
                    <TableHead>{t("employees.field.employeeCode")}</TableHead>
                    <TableHead>{t("common.status")}</TableHead>
                    <TableHead>{t("employees.upload.detailColumn")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rowsToReview.map((row) => (
                    <ReviewRow key={row.row} row={row} />
                  ))}
                  {rowsToReview.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                        {t("employees.upload.noChanges")}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {preview.departedEmployees.length > 0 && (
              <div className="rounded-md border p-3 text-sm">
                <p className="mb-1 font-medium">{t("employees.upload.departedTitle")}</p>
                <p className="mb-2 text-xs text-muted-foreground">{t("employees.upload.departedHint")}</p>
                <ul className="max-h-24 list-disc overflow-y-auto pl-5 text-xs text-muted-foreground">
                  {preview.departedEmployees.map((d) => (
                    <li key={d.employeeId}>
                      {d.employeeCode} — {d.fullName}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={() => setStep("select")} disabled={confirmPending}>
                {t("employees.upload.back")}
              </Button>
              <Button onClick={handleConfirm} disabled={confirmPending}>
                {confirmPending ? t("employees.upload.confirming") : t("employees.upload.confirm")}
              </Button>
            </div>
          </div>
        )}

        {step === "result" && commitResult && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <SummaryPill label={t("employees.upload.summaryNew")} value={commitResult.created} tone="new" />
              <SummaryPill label={t("employees.upload.resultUpdated")} value={commitResult.updated} tone="updated" />
              <SummaryPill label={t("employees.upload.summaryDeparted")} value={commitResult.departed} tone="departed" />
              <SummaryPill label={t("employees.upload.summaryError")} value={commitResult.skippedErrors} tone="error" />
            </div>
            <Button onClick={() => handleClose(false)} className="self-end">
              {t("common.close")}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// "existing" (unchanged rows) is informational, not a risk tone, so it intentionally
// stays its own literal blue rather than being forced into the shared success/warning/
// critical/neutral palette.
const TONE_CLASSES: Record<string, string> = {
  new: STATUS_BANNER_CLASS.success,
  existing: "border-blue-500/30 bg-blue-500/5 text-blue-600 dark:text-blue-400",
  updated: STATUS_BANNER_CLASS.warning,
  error: STATUS_BANNER_CLASS.critical,
  departed: STATUS_BANNER_CLASS.neutral,
};

function SummaryPill({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className={`rounded-md border p-2 text-center ${TONE_CLASSES[tone]}`}>
      <div className="text-lg font-bold leading-none">{value}</div>
      <div className="mt-1 text-[11px] uppercase tracking-wide">{label}</div>
    </div>
  );
}

function ReviewRow({ row }: { row: ClassifiedEmployeeRow }) {
  const t = useT();

  const statusLabel: Record<string, string> = {
    new: t("employees.upload.summaryNew"),
    updated: t("employees.upload.summaryUpdated"),
    error: t("employees.upload.summaryError"),
  };

  return (
    <TableRow>
      <TableCell className="text-muted-foreground">{row.row}</TableCell>
      <TableCell className="font-medium">{row.employeeCode || "—"}</TableCell>
      <TableCell>{statusLabel[row.status] ?? row.status}</TableCell>
      <TableCell className="text-xs">
        {row.status === "updated" &&
          row.diffs.map((d) => (
            <div key={d.field}>
              {t(FIELD_LABEL_KEYS[d.field])}: {d.oldValue || "—"} → {d.newValue || "—"}
            </div>
          ))}
        {row.status === "error" && row.errors.map((e) => <div key={e} className="text-destructive">{t(e as DictionaryKey)}</div>)}
      </TableCell>
    </TableRow>
  );
}
