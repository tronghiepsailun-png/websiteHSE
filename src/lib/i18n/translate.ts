import vi, { type DictionaryKey } from "./vi";
import zh from "./zh";

export type Locale = "vi" | "zh";
export const DEFAULT_LOCALE: Locale = "vi";
export const LOCALE_COOKIE = "hse_locale";

const dictionaries: Record<Locale, Record<DictionaryKey, string>> = { vi, zh };

/** Pure, synchronous translation lookup — safe to call from server or client code. */
export function t(locale: Locale, key: DictionaryKey, vars?: Record<string, string | number>): string {
  const template = dictionaries[locale]?.[key] ?? dictionaries[DEFAULT_LOCALE][key] ?? key;
  if (!vars) return template;
  return Object.entries(vars).reduce((acc, [name, value]) => acc.replaceAll(`{${name}}`, String(value)), template);
}

export function isLocale(value: string | undefined | null): value is Locale {
  return value === "vi" || value === "zh";
}

export type { DictionaryKey };
