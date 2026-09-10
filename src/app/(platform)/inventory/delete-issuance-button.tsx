"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteInventoryTransactionAction } from "./actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useT } from "@/lib/i18n/locale-context";

export function DeleteIssuanceButton({ id }: { id: string }) {
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      await deleteInventoryTransactionAction(id);
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
      description={t("inventory.issuance.confirmDelete")}
      confirmLabel={t("common.delete")}
      onConfirm={handleConfirm}
      pending={pending}
    />
  );
}
