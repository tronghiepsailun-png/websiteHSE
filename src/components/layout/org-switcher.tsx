"use client";

import { ChevronsUpDown, Building2 } from "lucide-react";
import { switchOrganizationAction } from "@/app/(platform)/actions";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useT } from "@/lib/i18n/locale-context";

export function OrgSwitcher({
  activeOrg,
  organizations,
}: {
  activeOrg: { id: string; name: string; code: string } | null;
  organizations: { id: string; name: string; code: string }[];
}) {
  const t = useT();

  if (organizations.length <= 1 && activeOrg) {
    return (
      <div className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
        <Building2 className="size-4 text-muted-foreground" />
        <span className="font-medium">{activeOrg.name}</span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={buttonVariants({ variant: "outline", size: "sm", className: "gap-2" })}>
        <Building2 className="size-4" />
        {activeOrg ? activeOrg.name : t("org.select")}
        <ChevronsUpDown className="size-3.5 opacity-50" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("org.switch")}</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {organizations.map((org) => (
          <DropdownMenuItem key={org.id} className="p-0">
            <form action={switchOrganizationAction} className="w-full">
              <input type="hidden" name="organizationId" value={org.id} />
              <button type="submit" className="flex w-full items-center justify-between px-1.5 py-1">
                <span>{org.name}</span>
                <span className="text-xs text-muted-foreground">{org.code}</span>
              </button>
            </form>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
