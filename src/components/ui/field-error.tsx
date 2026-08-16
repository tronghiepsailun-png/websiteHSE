"use client";

import { useT } from "@/lib/i18n/locale-context";
import type { DictionaryKey } from "@/lib/i18n/translate";
import type { FieldErrorKind } from "@/lib/form-errors";

const MESSAGE_KEY: Record<FieldErrorKind, DictionaryKey> = {
  required: "common.form.required",
  tooLong: "common.form.tooLong",
  invalid: "common.invalidInput",
};

/** Renders the small red message under a field — pair with `aria-invalid` on the input. */
export function FieldError({ kind }: { kind?: FieldErrorKind }) {
  const t = useT();
  if (!kind) return null;
  return <p className="text-xs text-destructive">{t(MESSAGE_KEY[kind])}</p>;
}
