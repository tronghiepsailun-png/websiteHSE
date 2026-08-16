/** Formats an incident's cost fields for display. Prefers VND (the platform's home
 *  currency); shows RMB alongside when present. Returns "—" when nothing is set. */
export function formatIncidentCost(incident: { costVnd?: number | null; costRmb?: number | null; cost?: number | null }) {
  const vnd = incident.costVnd ?? incident.cost ?? null;
  const parts: string[] = [];
  if (vnd != null) parts.push(`${Math.round(vnd).toLocaleString("vi-VN")} ₫`);
  if (incident.costRmb != null) parts.push(`¥${incident.costRmb.toLocaleString("vi-VN", { maximumFractionDigits: 2 })}`);
  return parts.length > 0 ? parts.join(" / ") : "—";
}
