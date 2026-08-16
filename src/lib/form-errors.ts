import type { z } from "zod";

/**
 * Generic per-field validation kinds — deliberately NOT per-field custom messages.
 * Reusing zod's own custom `.min(1, "...")` message text would mean translating every
 * schema field individually; mapping zod's structural issue code to one of these 3
 * kinds instead gives every form field-level feedback with just 2 new i18n keys total
 * (`common.form.required` / `common.form.tooLong`, plus the already-existing
 * `common.invalidInput`).
 */
export type FieldErrorKind = "required" | "tooLong" | "invalid";
export type FieldErrors = Record<string, FieldErrorKind>;

export function zodFieldErrors(error: z.ZodError): FieldErrors {
  const result: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key !== "string" || key in result) continue;
    if (issue.code === "too_small") result[key] = "required";
    else if (issue.code === "too_big") result[key] = "tooLong";
    else result[key] = "invalid";
  }
  return result;
}
