"use client";

import Link from "next/link";
import { LogOut, Settings, User } from "lucide-react";
import { logoutAction } from "@/app/(platform)/actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function UserMenu({
  name,
  email,
  isPlatformAdmin,
  showSettings,
}: {
  name: string;
  email: string;
  isPlatformAdmin: boolean;
  showSettings: boolean;
}) {
  const t = useT();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={buttonVariants({ variant: "ghost", size: "sm", className: "gap-2 px-1.5" })}>
        <Avatar className="size-7">
          <AvatarFallback className="text-xs">{initials(name)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col">
            <span className="font-medium">{name}</span>
            <span className="text-xs font-normal text-muted-foreground">{email}</span>
            {isPlatformAdmin && (
              <span className="mt-1 flex items-center gap-1 text-xs font-normal text-primary">
                <User className="size-3" /> {t("auth.platformAdmin")}
              </span>
            )}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {showSettings && (
          <DropdownMenuItem className="p-0">
            <Link href="/settings" className="flex w-full items-center gap-2 px-1.5 py-1">
              <Settings className="size-4" /> {t("nav.settings")}
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem className="p-0">
          <form action={logoutAction} className="w-full">
            <button type="submit" className="flex w-full items-center gap-2 px-1.5 py-1">
              <LogOut className="size-4" /> {t("auth.signOut")}
            </button>
          </form>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
