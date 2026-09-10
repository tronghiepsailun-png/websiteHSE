"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useT } from "@/lib/i18n/locale-context";

// next-themes only knows the real theme after mount (it reads localStorage client-side) —
// rendering the icon before that would flash the wrong one, so this stays blank until mounted.
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const t = useT();

  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="size-9" />;

  const isDark = resolvedTheme === "dark";

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            title={t("layout.theme.toggle")}
          />
        }
      >
        {isDark ? <Sun className="size-4.5" /> : <Moon className="size-4.5" />}
      </TooltipTrigger>
      <TooltipContent>{isDark ? t("layout.theme.light") : t("layout.theme.dark")}</TooltipContent>
    </Tooltip>
  );
}
