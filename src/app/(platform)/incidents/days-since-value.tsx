"use client";

import { useT } from "@/lib/i18n/locale-context";

/** Client leaf so the "ngày/天" suffix (and the empty-state message) switch language
 *  instantly, matching the rest of the bilingual UI — a plain server-rendered string
 *  would stay frozen in whatever locale was active at the last server render. */
export function DaysSinceValue({ days }: { days: number | null }) {
  const t = useT();
  if (days === null) return <>{t("incidents.kpi.noIncidentsYet")}</>;
  return (
    <>
      {days.toLocaleString("vi-VN")} {t("common.days")}
    </>
  );
}
