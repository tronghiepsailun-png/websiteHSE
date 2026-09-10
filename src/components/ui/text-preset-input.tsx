"use client";

import { useRef } from "react";
import { ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/locale-context";

/** A plain text <input> plus an attached dropdown of catalog presets — picking one writes
 *  straight into the input's DOM value via ref (the input is uncontrolled, so this is just
 *  what the user would've typed by hand). The border/rounding/focus-ring all live on the outer
 *  div, not on the <input> itself, so the field and the dropdown trigger read as one bordered
 *  box (matching EmployeeCombobox's look) instead of two separate adjacent controls. Generic
 *  counterpart to AmountInput, for any free-text field with org-managed quick-pick suggestions. */
export function TextPresetInput({
  name,
  formId,
  defaultValue,
  placeholder,
  required,
  className,
  options,
}: {
  name: string;
  formId: string;
  defaultValue?: string | null;
  placeholder?: string;
  required?: boolean;
  className?: string;
  options: { value: string; label: string }[];
}) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);

  if (options.length === 0) {
    return <Input ref={inputRef} name={name} form={formId} defaultValue={defaultValue ?? ""} placeholder={placeholder} required={required} className={className} />;
  }

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
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        required={required}
        className="h-full min-w-0 flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0"
      />
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={t("common.quickSelect")}
          className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground"
        >
          <ChevronDown className="size-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-h-80">
          {options.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => {
                const input = inputRef.current;
                if (!input) return;
                input.value = option.value;
                input.dispatchEvent(new Event("input", { bubbles: true }));
              }}
            >
              {option.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
