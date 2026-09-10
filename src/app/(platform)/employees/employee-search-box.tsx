"use client";

import { useEffect, useRef, useState } from "react";
import { Combobox } from "@base-ui/react/combobox";
import { cn } from "@/lib/utils";
import { searchEmployeesAction } from "@/components/employees/employee-search-actions";
import type { EmployeeLite } from "@/server/employees";

function formatEmployee(e: EmployeeLite) {
  return `${e.employeeCode} — ${e.fullName}${e.fullNameZh ? ` (${e.fullNameZh})` : ""}`;
}

/** Free-text employee search box that also shows a live server-side dropdown of matches
 *  as the user types a code/name — picking a suggestion filters straight to that employee.
 *  The visible input text (what the user types/sees, and what drives the dropdown) is kept
 *  separate from the value actually submitted as `name` — a hidden input carries that,
 *  since Base UI insists on re-syncing the visible text to the picked item's full label,
 *  which would otherwise clobber a "just the employee code" submission. */
export function EmployeeSearchBox({
  name,
  defaultValue,
  placeholder,
  emptyLabel,
  className,
  onSubmit,
}: {
  name: string;
  defaultValue?: string;
  placeholder: string;
  emptyLabel: string;
  className?: string;
  onSubmit: () => void;
}) {
  const [inputValue, setInputValue] = useState(defaultValue ?? "");
  const [submitValue, setSubmitValue] = useState(defaultValue ?? "");
  const [options, setOptions] = useState<EmployeeLite[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // onValueChange (a pick) fires, then Base UI immediately fires onInputValueChange again to
  // resync the visible text to the picked item's full label — this ref tells that resync
  // apart from real typing, so it doesn't clobber the employeeCode onValueChange just submitted.
  const justPickedRef = useRef(false);
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Combobox.Input silently drops an onKeyDown prop (Base UI's useRenderElement only forwards
  // className/style/render from direct component props) — so Enter is wired via a native
  // listener on the underlying <input> instead, attached directly to the DOM node so it fires
  // before Base UI's own root-delegated key handling (which would otherwise commit whatever
  // item is auto-highlighted instead of submitting the typed free-text search).
  useEffect(() => {
    const node = inputRef.current;
    if (!node) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        onSubmitRef.current();
      }
    };
    node.addEventListener("keydown", handler);
    return () => node.removeEventListener("keydown", handler);
  }, []);

  function handleInputValueChange(value: string) {
    setInputValue(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (justPickedRef.current) {
      justPickedRef.current = false;
      return;
    }

    setSubmitValue(value);
    if (!value.trim()) {
      setOptions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setOptions(await searchEmployeesAction(value));
    }, 250);
  }

  return (
    <Combobox.Root<EmployeeLite>
      items={options}
      itemToStringLabel={formatEmployee}
      itemToStringValue={(e) => e.id}
      inputValue={inputValue}
      onInputValueChange={handleInputValueChange}
      onValueChange={(value) => {
        if (!value) return;
        justPickedRef.current = true;
        setSubmitValue(value.employeeCode);
        setOptions([]);
        onSubmit();
      }}
      filter={null}
    >
      {/* Sibling of Root, not a child — carries the actual value the form submits. */}
      <input type="hidden" name={name} value={submitValue} />
      <div className={cn("relative", className)}>
        <Combobox.Input
          ref={inputRef}
          placeholder={placeholder}
          className="flex h-8 w-full items-center rounded-lg border border-input bg-transparent py-2 px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50"
        />
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
                  className="relative flex cursor-default items-center gap-1.5 rounded-md py-1.5 pr-2 pl-2 text-sm outline-none select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                >
                  {formatEmployee(item)}
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
