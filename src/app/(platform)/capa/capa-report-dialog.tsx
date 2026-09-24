"use client";

import { useState } from "react";
import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { useT } from "@/lib/i18n/locale-context";

const REPORTER_STORAGE_KEY = "capa_report_reporter";

function filenameFromDisposition(header: string | null): string {
  const star = header?.match(/filename\*=UTF-8''([^;]+)/i);
  if (star) {
    try {
      return decodeURIComponent(star[1]);
    } catch {
      // fall through to the ASCII fallback
    }
  }
  return header?.match(/filename="([^"]+)"/i)?.[1] ?? "bao-cao.pptx";
}

/** With rows ticked → report covers exactly those; with none ticked → every still-unresolved row
 *  in the current (filtered) list, since "vấn đề tồn động" is the report's usual audience. */
export function CapaReportDialog({
  selectedIds,
  unresolvedIds,
  defaultReporter,
}: {
  selectedIds: string[];
  unresolvedIds: string[];
  defaultReporter: string;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [reporter, setReporter] = useState(defaultReporter);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    if (next) {
      setError(null);
      try {
        const saved = window.localStorage.getItem(REPORTER_STORAGE_KEY);
        if (saved) setReporter(saved);
      } catch {
        // storage unavailable (private mode etc.) — keep the account name
      }
    }
    setOpen(next);
  }

  const ids = selectedIds.length > 0 ? selectedIds : unresolvedIds;
  const scope =
    selectedIds.length > 0
      ? t("capa.report.scopeSelected", { n: selectedIds.length })
      : unresolvedIds.length > 0
        ? t("capa.report.scopeUnresolved", { n: unresolvedIds.length })
        : t("capa.report.scopeNone");

  async function generate() {
    setPending(true);
    setError(null);
    try {
      try {
        window.localStorage.setItem(REPORTER_STORAGE_KEY, reporter);
      } catch {
        // non-essential convenience only
      }
      const res = await fetch("/api/capa/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, reporterName: reporter }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filenameFromDisposition(res.headers.get("Content-Disposition"));
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setOpen(false);
    } catch {
      setError(t("capa.report.error"));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button type="button" size="sm" variant="outline" />}>
        <FileDown className="size-4" />
        {t("capa.report.button")}
        {selectedIds.length > 0 && <span className="rounded-full bg-primary/10 px-1.5 text-xs text-primary">{selectedIds.length}</span>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("capa.report.title")}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{t("capa.report.description")}</p>
        <p className="rounded-md bg-muted px-3 py-2 text-sm">{scope}</p>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="capa-report-reporter">{t("capa.report.reporter")}</Label>
          <Input id="capa-report-reporter" value={reporter} onChange={(e) => setReporter(e.target.value)} maxLength={80} />
          <p className="text-xs text-muted-foreground">{t("capa.report.reporterHint")}</p>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button type="button" onClick={generate} disabled={pending || ids.length === 0}>
            <FileDown className="size-4" />
            {pending ? t("capa.report.generating") : t("capa.report.generate")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
