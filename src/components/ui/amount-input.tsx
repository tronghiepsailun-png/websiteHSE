"use client";

import { useRef } from "react";
import { ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/locale-context";

const AMOUNT_PRESETS_VND = [50000, 100000, 200000, 300000, 400000, 500000, 1000000];

/** A number input plus an attached dropdown of common fine amounts — picking a preset writes
 *  straight into the input's DOM value via ref (the input is uncontrolled, so this is just what
 *  the user would've typed by hand). The border/rounding/focus-ring all live on the outer div,
 *  not on the <input> itself, so the field and the dropdown trigger read as one bordered box
 *  (matching EmployeeCombobox's look) instead of two separate adjacent controls. Reused across
 *  every "Tiền phạt" column (5S / An toàn viên / Liên đế) so the shortcut stays consistent. */
export function AmountInput({
  name,
  formId,
  defaultValue,
  placeholder,
  required,
  className,
}: {
  name: string;
  formId: string;
  defaultValue?: number | string | null;
  placeholder?: string;
  required?: boolean;
  className?: string;
}) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      className={cn(
        "flex h-8 items-center gap-0.5 rounded-lg border border-input bg-transparent pr-1 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30",
        className
      )}
    >
      <Input
        ref={inputRef}
        name={name}
        form={formId}
        type="number"
        min={0}
        step={10000}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        required={required}
        className="h-full min-w-0 flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0"
      />
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={t("common.amountQuickSelect")}
          className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground"
        >
          <ChevronDown className="size-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {AMOUNT_PRESETS_VND.map((amount) => (
            <DropdownMenuItem
              key={amount}
              onClick={() => {
                const input = inputRef.current;
                if (!input) return;
                input.value = String(amount);
                input.dispatchEvent(new Event("input", { bubbles: true }));
              }}
            >
              {amount.toLocaleString("vi-VN")} đ
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
