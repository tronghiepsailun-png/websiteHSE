"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteIncidentAction } from "./actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useT } from "@/lib/i18n/locale-context";

export function DeleteIncidentButton({
  incidentId,
  incidentNumber,
  redirectAfterDelete = false,
  size = "sm",
}: {
  incidentId: string;
  incidentNumber: string;
  redirectAfterDelete?: boolean;
  size?: "sm" | "default";
}) {
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      await deleteIncidentAction(incidentId);
      if (redirectAfterDelete) router.push("/incidents");
      else router.refresh();
    });
  }

  return (
    <ConfirmDialog
      trigger={
        <Button type="button" variant="destructive" size={size} disabled={pending}>
          {pending ? t("common.deleting") : t("common.delete")}
        </Button>
      }
      description={t("incidents.detail.confirmDelete", { number: incidentNumber })}
      confirmLabel={t("common.delete")}
      onConfirm={handleConfirm}
      pending={pending}
    />
  );
}
