export const REPORT_VIEWS = ["detail", "stats", "score", "deduction", "kpi"] as const;
export type ReportView = (typeof REPORT_VIEWS)[number];

export function parseReportView(value: unknown): ReportView {
  return typeof value === "string" && (REPORT_VIEWS as readonly string[]).includes(value) ? (value as ReportView) : "detail";
}
