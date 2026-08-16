"use client";

import { useLocale } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/i18n/translate";

const OPTIONS: { locale: Locale; label: string }[] = [
  { locale: "vi", label: "VI" },
  { locale: "zh", label: "中文" },
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
            "rounded-[5px] px-2 py-1 transition-colors",
            locale === option.locale
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
