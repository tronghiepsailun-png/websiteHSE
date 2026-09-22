/** Formats an incident's cost fields for display. Prefers VND (the platform's home
 *  currency); shows RMB alongside when present. Returns "—" when nothing is set. */
export function formatIncidentCost(incident: { costVnd?: number | null; costRmb?: number | null; cost?: number | null }) {
  const vnd = incident.costVnd ?? incident.cost ?? null;
  const parts: string[] = [];
  if (vnd != null) parts.push(`${Math.round(vnd).toLocaleString("vi-VN")} ₫`);
  if (incident.costRmb != null) parts.push(`¥${incident.costRmb.toLocaleString("vi-VN", { maximumFractionDigits: 2 })}`);
  return parts.length > 0 ? parts.join(" / ") : "—";
}

/** Download-date prefix for exported files, e.g. "2026-9-21" — no leading zeros, the way a
 *  person writes today's date by hand. Always computed in Vietnam local time regardless of
 *  the server's own clock (the VPS runs on UTC — a plain `new Date()` would show yesterday's
 *  date for anyone downloading between midnight and 7am Vietnam time). */
export function exportDatePrefix() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Prefixes an export's base file name (no extension) with today's download date, e.g.
 *  `exportFileName("Vi phạm an toàn viên")` → "2026-9-21 Vi phạm an toàn viên". */
export function exportFileName(baseName: string) {
  return `${exportDatePrefix()} ${baseName}`;
}

/** Compact VND for tight KPI tiles (mobile summary chips) — the full "2.283.308.308 ₫" is
 *  too long to fit one line at a readable size; "2,28 tỷ ₫" reads at a glance the way a real
 *  dashboard would. Only the home currency is shown here (not RMB too) — precise per-currency
 *  figures stay one tap away in the incident list. Below 1 triệu, abbreviating loses meaningful
 *  precision, so the plain number is kept. */
export function formatCompactVnd(n: number | null | undefined) {
  if (n == null) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 2 })} tỷ ₫`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} triệu ₫`;
  return `${Math.round(n).toLocaleString("vi-VN")} ₫`;
}
