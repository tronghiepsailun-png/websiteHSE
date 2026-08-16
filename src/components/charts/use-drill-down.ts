"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** Clicking a chart segment sets one query param (on top of whatever's already in the
 *  URL) and jumps to the incident list below — same-page soft navigation, no reload. */
export function useDrillDown(filterParam?: string) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (!filterParam) return undefined;

  return (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(filterParam, value);
    router.push(`${pathname}?${params.toString()}#incidents-list`);
  };
}
