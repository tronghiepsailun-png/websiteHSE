/** Counts how many of the given filter values are actually set — callers pass only the
 * already-normalized props of each filter bar ("all"/"" already collapsed to undefined). */
export function countActiveFilters(...values: (string | undefined)[]): number {
  return values.filter((v) => v !== undefined && v !== "").length;
}
