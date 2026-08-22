"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteWorkPlanItemAction } from "./actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useT } from "@/lib/i18n/locale-context";

export function DeleteWorkPlanButton({ id }: { id: string }) {
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      await deleteWorkPlanItemAction(id);
      router.refresh();
    });
  }

  return (
    <ConfirmDialog
      trigger={
        <Button type="button" variant="ghost" size="icon" className="size-7" disabled={pending} title={t("common.delete")}>
          <Trash2 className="size-3.5" />
        </Button>
      }
      description={t("workplan.confirmDelete")}
      confirmLabel={t("common.delete")}
      onConfirm={handleConfirm}
      pending={pending}
    />
  );
}
