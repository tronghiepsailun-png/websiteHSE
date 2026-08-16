"use client";

import { useT } from "@/lib/i18n/locale-context";
import type { DictionaryKey } from "@/lib/i18n/translate";

/**
 * Renders translated text as a leaf Client Component so it can be embedded
 * directly inside Server Component JSX (page titles, table headers, static
 * labels) and still switch language instantly with zero server round-trip.
 */
export function T({ k, vars }: { k: DictionaryKey; vars?: Record<string, string | number> }) {
  const t = useT();
  return <>{t(k, vars)}</>;
}
