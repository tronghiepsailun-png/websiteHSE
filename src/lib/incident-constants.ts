/** Historical CCG data shows pointsDeducted is a fixed function of severity (A never deducts;
 *  other codes not listed here don't have a fixed convention and are left to manual entry).
 *  Shared between the server action (fallback when the field is left blank) and both incident
 *  forms (auto-fills the field the instant severity is picked, so the reporter never has to
 *  remember or look up the fixed value themselves). */
export const DEFAULT_POINTS_DEDUCTED_BY_SEVERITY: Record<string, number> = { B: 0.1, C: 0.3, D: 0.5 };

/** Historical CCG data (380+ incidents) shows a department's own name encodes which factory
 *  phase it belongs to (一期/二期/三期), and that phase alone determines "Mã nhà máy" at ~98%+
 *  consistency — a department whose name has none of these phase markers has no fixed
 *  convention and is left to manual entry instead. */
const FACTORY_CODE_BY_ZONE: { zone: string; code: string }[] = [
  { zone: "一期", code: "31" },
  { zone: "二期", code: "41" },
  { zone: "三期", code: "1102" },
];

export function deriveFactoryCode(orgUnitName: string | null | undefined): string | null {
  if (!orgUnitName) return null;
  const match = FACTORY_CODE_BY_ZONE.find((z) => orgUnitName.includes(z.zone));
  return match ? match.code : null;
}

/** Common injured-body-part values for the quick-pick <datalist> on "Vị trí bị thương" — the
 *  field stays a plain free-text input (a <datalist> never restricts what can be typed), this
 *  just gives reporters a fast, consistent set of options instead of retyping the same values
 *  every time. */
export const INJURED_BODY_PART_OPTIONS = [
  "Đầu",
  "Mặt",
  "Mắt",
  "Cổ",
  "Vai",
  "Cánh tay",
  "Cổ tay",
  "Bàn tay",
  "Ngón tay",
  "Ngực",
  "Bụng",
  "Lưng",
  "Hông",
  "Đùi",
  "Đầu gối",
  "Cổ chân",
  "Bàn chân",
  "Ngón chân",
  "Toàn thân",
];
