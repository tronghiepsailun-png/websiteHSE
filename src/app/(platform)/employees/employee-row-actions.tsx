"use client";

import { useState } from "react";
import Link from "next/link";
import { MoreHorizontal, Eye, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useT } from "@/lib/i18n/locale-context";
import { EmployeeDetailSheet, type EmployeeDetailData } from "./employee-detail-sheet";

export function EmployeeRowActions({ employee, canManage }: { employee: EmployeeDetailData & { id: string }; canManage: boolean }) {
  const t = useT();
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setSheetOpen(true)}>
            <Eye className="size-4" />
            {t("common.viewDetails")}
          </DropdownMenuItem>
          {canManage && (
            <DropdownMenuItem render={<Link href={`/employees/${employee.id}/edit`} />}>
              <Pencil className="size-4" />
              {t("common.edit")}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <EmployeeDetailSheet employee={employee} open={sheetOpen} onOpenChange={setSheetOpen} />
    </>
  );
}
