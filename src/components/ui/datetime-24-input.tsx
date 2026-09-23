"use client";

import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// A native <input type="datetime-local"> (or "time") renders its clock in whatever format
// the BROWSER's own locale uses — Chromium ignores the page/element `lang` attribute for
// this, so on a Vietnamese-locale browser it always shows 12h with SA/CH (AM/PM) markers, no
// matter what the app's own language is set to. Only a fully custom (non-native) time control
// is guaranteed 24h everywhere — hence date (unambiguous, no native fix needed) + two plain
// digit boxes for hour/minute here, combined into one "YYYY-MM-DDTHH:mm" value for the form.

function splitValue(v: string): { date: string; hh: string; mm: string } {
  const [date, time] = v.split("T");
  const [hh, mm] = (time ?? "").split(":");
  return { date: date ?? "", hh: hh ?? "", mm: mm ?? "" };
}

function clamp(raw: string, max: number): string {
  const n = Math.min(max, Math.max(0, Number(raw) || 0));
  return String(n).padStart(2, "0");
}

export function DateTime24Input({
  name,
  value,
  defaultValue,
  onChange,
  required,
  ariaInvalid,
  className,
}: {
  name: string;
  /** Controlled mode — pass alongside onChange. */
  value?: string;
  /** Uncontrolled mode — initial "YYYY-MM-DDTHH:mm" value, e.g. from an existing record. */
  defaultValue?: string;
  onChange?: (value: string) => void;
  required?: boolean;
  ariaInvalid?: boolean;
  className?: string;
}) {
  const isControlled = value !== undefined;
  const [internal, setInternal] = useState(() => defaultValue ?? value ?? "");
  const current = isControlled ? value! : internal;
  const parts = splitValue(current);
  const mmRef = useRef<HTMLInputElement>(null);

  function commit(date: string, hh: string, mm: string) {
    const next = date && hh !== "" && mm !== "" ? `${date}T${hh}:${mm}` : "";
    if (!isControlled) setInternal(next);
    onChange?.(next);
  }

  function handleDigits(raw: string) {
    return raw.replace(/\D/g, "").slice(0, 2);
  }

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <input type="hidden" name={name} value={current} required={required} />
      <Input
        type="date"
        value={parts.date}
        onChange={(e) => commit(e.target.value, parts.hh, parts.mm)}
        aria-invalid={ariaInvalid}
        className="min-w-0 flex-1"
      />
      <div className="flex items-center gap-0.5">
        <Input
          value={parts.hh}
          onChange={(e) => {
            const digits = handleDigits(e.target.value);
            commit(parts.date, digits, parts.mm);
            if (digits.length === 2) mmRef.current?.focus();
          }}
          onBlur={(e) => commit(parts.date, e.target.value ? clamp(e.target.value, 23) : "", parts.mm)}
          inputMode="numeric"
          placeholder="HH"
          maxLength={2}
          className="w-11 text-center"
          aria-label="Giờ"
        />
        <span className="text-muted-foreground">:</span>
        <Input
          ref={mmRef}
          value={parts.mm}
          onChange={(e) => commit(parts.date, parts.hh, handleDigits(e.target.value))}
          onBlur={(e) => commit(parts.date, parts.hh, e.target.value ? clamp(e.target.value, 59) : "")}
          inputMode="numeric"
          placeholder="MM"
          maxLength={2}
          className="w-11 text-center"
          aria-label="Phút"
        />
      </div>
    </div>
  );
}
