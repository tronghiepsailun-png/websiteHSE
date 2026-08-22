"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteViolationAction } from "./actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useT } from "@/lib/i18n/locale-context";

export function DeleteViolationButton({ violationId }: { violationId: string }) {
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      await deleteViolationAction(violationId);
      router.refresh();
    });
  }

  return (
    <ConfirmDialog
      trigger={
        <Button type="button" variant="ghost" size="sm" disabled={pending}>
          {pending ? t("common.deleting") : t("common.delete")}
        </Button>
      }
      description={t("violations.log.confirmDelete")}
      confirmLabel={t("common.delete")}
      onConfirm={handleConfirm}
      pending={pending}
    />
  );
}
