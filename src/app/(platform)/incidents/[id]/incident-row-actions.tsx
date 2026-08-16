"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Eye, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteIncidentAction } from "./actions";
import { useT } from "@/lib/i18n/locale-context";

export function IncidentRowActions({
  incidentId,
  incidentNumber,
  canDelete,
}: {
  incidentId: string;
  incidentNumber: string;
  canDelete: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (!window.confirm(t("incidents.detail.confirmDelete", { number: incidentNumber }))) return;
    startTransition(async () => {
      await deleteIncidentAction(incidentId);
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" disabled={pending} />}>
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem render={<Link href={`/incidents/${incidentId}`} />}>
          <Eye className="size-4" />
          {t("common.viewDetails")}
        </DropdownMenuItem>
        {canDelete && (
          <DropdownMenuItem variant="destructive" onClick={handleDelete}>
            <Trash2 className="size-4" />
            {t("common.delete")}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
