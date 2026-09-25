"use client";

import { useEffect, useRef, useState } from "react";
import { Combobox } from "@base-ui/react/combobox";
import { ChevronDownIcon, CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { searchEmployeesAction } from "./employee-search-actions";
import type { EmployeeLite } from "@/server/employees";

function formatEmployee(e: EmployeeLite) {
  return `${e.employeeCode} — ${e.fullName}${e.fullNameZh ? ` (${e.fullNameZh})` : ""}`;
}

/** Employee picker that searches server-side as you type instead of shipping the full
 *  ~3000-row employee table to the client — swap-in replacement for a plain <Select>
 *  wherever a form needs "pick one employee". */
export function EmployeeCombobox({
  name,
  placeholder,
  emptyLabel,
  className,
  defaultValue,
  formId,
  valueMode = "id",
  defaultText,
}: {
  name: string;
  placeholder: string;
  emptyLabel: string;
  className?: string;
  /** "id" (default) submits the picked employee's id and requires a pick. "name" submits the
   *  text in the box instead — picking a suggestion fills in that employee's Vietnamese name,
   *  but whatever is typed is kept as-is, for fields stored as plain text that may also name
   *  someone outside the roster (e.g. a report's author). */
  valueMode?: "id" | "name";
  /** Initial text for "name" mode (the value already saved on the record being edited). */
  defaultText?: string;
  /** Pre-selects an employee (e.g. editing a record that already has one) without an extra
   *  search round-trip — the caller already has the full row loaded. */
  defaultValue?: EmployeeLite | null;
  /** Associates the hidden value input with a <form> elsewhere in the DOM (e.g. a table row's
   *  cells sitting outside any <form> ancestor) via the native form="" attribute. */
  formId?: string;
}) {
  const nameMode = valueMode === "name";
  const [inputValue, setInputValue] = useState(nameMode ? (defaultText ?? "") : defaultValue ? formatEmployee(defaultValue) : "");
  const [options, setOptions] = useState<EmployeeLite[]>([]);
  const [selected, setSelected] = useState<EmployeeLite | null>(defaultValue ?? null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Base UI fires onValueChange (a pick) and onInputValueChange (syncing the input to that
  // item's label) in the same synchronous batch. Reading React state inside
  // handleInputValueChange to tell them apart sees the pre-batch `selected`, so the
  // just-made selection gets clobbered — a ref updates immediately, sidestepping that.
  const justSelectedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function handleInputValueChange(value: string) {
    setInputValue(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (justSelectedRef.current) {
      justSelectedRef.current = false;
      return;
    }
    setSelected(null);

    if (!value.trim()) {
      setOptions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setOptions(await searchEmployeesAction(value));
    }, 250);
  }

  return (
    <div>
      {/* Rendered as a sibling of Root, not a child — Base UI's own `name` prop doesn't
          generate a form-submittable hidden input for object-typed item values, and an
          extra child inside Root risks confusing its internal item collection. */}
      <input type="hidden" name={name} form={formId} value={nameMode ? inputValue.trim() : (selected?.id ?? "")} />
      <Combobox.Root<EmployeeLite>
        items={options}
        itemToStringLabel={nameMode ? (e) => e.fullName : formatEmployee}
        itemToStringValue={(e) => e.id}
        inputValue={inputValue}
        onInputValueChange={handleInputValueChange}
        // Name mode keeps the pick under our control, so typing over a picked name really does
        // un-pick it instead of Base UI snapping the text back to that name when focus leaves.
        {...(nameMode ? { value: selected } : {})}
        onValueChange={(value) => {
          justSelectedRef.current = true;
          setSelected(value);
          if (value) setInputValue(nameMode ? value.fullName : formatEmployee(value));
        }}
        filter={null}
      >
        <div className="relative">
          <Combobox.Input
            placeholder={placeholder}
            className={cn(
              "flex h-8 w-full items-center rounded-lg border border-input bg-transparent py-2 pr-8 pl-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50",
              className
            )}
          />
          <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-2 size-4 -translate-y-1/2 text-muted-foreground" />
        </div>
        <Combobox.Portal>
          <Combobox.Positioner className="isolate z-50" sideOffset={4} side="bottom" align="start">
            <Combobox.Popup className="max-h-64 w-max min-w-(--anchor-width) max-w-(--available-width) overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10">
              <Combobox.Empty className="px-2 py-4 text-center text-sm text-muted-foreground">
                {emptyLabel}
              </Combobox.Empty>
              <Combobox.List>
                {(item: EmployeeLite) => (
                  <Combobox.Item
                    key={item.id}
                    value={item}
                    className="relative flex cursor-default items-center gap-1.5 rounded-md py-1.5 pr-7 pl-2 text-sm outline-none select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                  >
                    {formatEmployee(item)}
                    <Combobox.ItemIndicator className="absolute right-2 flex items-center">
                      <CheckIcon className="size-4" />
                    </Combobox.ItemIndicator>
                  </Combobox.Item>
                )}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    </div>
  );
}
