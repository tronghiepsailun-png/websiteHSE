"use client";

import { useLocale } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/i18n/translate";
import { VietnamFlag, ChinaFlag } from "./flag-icons";

const OPTIONS: { locale: Locale; label: string; Flag: typeof VietnamFlag }[] = [
  { locale: "vi", label: "VI", Flag: VietnamFlag },
  { locale: "zh", label: "中文", Flag: ChinaFlag },
];

export function LanguageSwitcher() {
  const { locale, setLocale } = useLocale();

  return (
    <div className="flex items-center rounded-md border p-0.5 text-xs font-medium">
      {OPTIONS.map((option) => (
        <button
          key={option.locale}
          type="button"
          onClick={() => setLocale(option.locale)}
          aria-pressed={locale === option.locale}
          className={cn(
            "flex items-center gap-1.5 rounded-[5px] px-2 py-1 transition-colors",
            locale === option.locale
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <option.Flag className="h-3 w-[18px] shrink-0 rounded-[2px]" />
          {option.label}
        </button>
      ))}
    </div>
  );
}
