import type { DictionaryKey } from "@/lib/i18n/translate";

export type ToggleableColumn<Id extends string = string> = { id: Id; labelKey: DictionaryKey };

/** Reads a "hidden columns" cookie (a comma-joined list of column ids) back into a Set, dropping
 *  any id that isn't a known column for this table — so a stale cookie from a since-renamed
 *  column can't silently hide something the current column list never defined. */
export function parseHiddenColumns<Id extends string>(cookieValue: string | undefined, columns: ToggleableColumn<Id>[]): Set<Id> {
  if (!cookieValue) return new Set();
  const known = new Set<string>(columns.map((c) => c.id));
  return new Set(cookieValue.split(",").filter((id): id is Id => known.has(id)));
}
