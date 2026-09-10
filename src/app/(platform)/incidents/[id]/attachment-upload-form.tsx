"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { uploadIncidentAttachmentAction, type UploadAttachmentState } from "./actions";
import { Button } from "@/components/ui/button";
import { FileInput } from "@/components/ui/file-input";
import { Label } from "@/components/ui/label";
import { useT } from "@/lib/i18n/locale-context";

export function AttachmentUploadForm({ incidentId }: { incidentId: string }) {
  const t = useT();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<UploadAttachmentState, FormData>(uploadIncidentAttachmentAction, undefined);
  // FileInput tracks its own "chosen file" label in React state, which form.reset() below can't
  // touch (it doesn't fire a change event) — remounting via key clears that label along with the
  // native input's own value.
  const [fileInputKey, setFileInputKey] = useState(0);

  // Clear the native file input's "chosen file" label after every successful submit —
  // React doesn't reset uncontrolled file inputs on its own re-renders.
  useEffect(() => {
    if (!pending && !state?.error) {
      formRef.current?.reset();
      setFileInputKey((k) => k + 1);
    }
  }, [pending, state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="incidentId" value={incidentId} />
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="file">{t("common.upload")}</Label>
          <FileInput
            key={fileInputKey}
            id="file"
            name="file"
            accept="image/jpeg,image/png,image/webp,image/gif,.pdf,.doc,.docx,.xls,.xlsx"
            required
          />
        </div>
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {pending ? t("common.uploading") : t("common.upload")}
        </Button>
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
