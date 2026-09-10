"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type ColumnWidths = Record<string, number>;

const WidthsContext = createContext<{ widths: ColumnWidths; setWidth: (key: string, width: number) => void } | null>(
  null
);

function useWidths() {
  const ctx = useContext(WidthsContext);
  if (!ctx) throw new Error("Resizable column components must be used inside ResizableTableProvider");
  return ctx;
}

/** Column widths the user drags are saved to localStorage under `storageKey`, so the layout
 *  they set up is still there next time they open the page — same idea as the locale/theme
 *  preference, just scoped to this one table instead of the whole app. Starts from
 *  `defaultWidths` (matches what the server rendered) and only applies the saved widths after
 *  mount, so hydration never sees a mismatch. */
export function ResizableTableProvider({
  storageKey,
  defaultWidths,
  children,
}: {
  storageKey: string;
  defaultWidths: ColumnWidths;
  children: React.ReactNode;
}) {
  const [widths, setWidths] = useState<ColumnWidths>(defaultWidths);
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setWidths((prev) => ({ ...prev, ...JSON.parse(raw) }));
    } catch {
      // corrupt/unavailable storage — just keep the defaults
    }
  }, [storageKey]);

  function setWidth(key: string, width: number) {
    setWidths((prev) => {
      const next = { ...prev, [key]: width };
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // storage full/unavailable — the resize still works for this session
      }
      return next;
    });
  }

  return <WidthsContext.Provider value={{ widths, setWidth }}>{children}</WidthsContext.Provider>;
}

export function ResizableColGroup({ order }: { order: string[] }) {
  const { widths } = useWidths();
  return (
    <colgroup>
      {order.map((key) => (
        <col key={key} style={{ width: `${widths[key]}px` }} />
      ))}
    </colgroup>
  );
}

export function ResizableTh({
  columnKey,
  minWidth = 60,
  resizable = true,
  className,
  children,
}: {
  columnKey: string;
  minWidth?: number;
  resizable?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const { widths, setWidth } = useWidths();
  const dragState = useRef<{ startX: number; startWidth: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  function handlePointerDown(e: React.PointerEvent<HTMLSpanElement>) {
    e.preventDefault();
    dragState.current = { startX: e.clientX, startWidth: widths[columnKey] };
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function handlePointerMove(e: React.PointerEvent<HTMLSpanElement>) {
    if (!dragState.current) return;
    const delta = e.clientX - dragState.current.startX;
    setWidth(columnKey, Math.max(minWidth, Math.round(dragState.current.startWidth + delta)));
  }
  function handlePointerUp(e: React.PointerEvent<HTMLSpanElement>) {
    dragState.current = null;
    setDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  }

  return (
    <TableHead className={cn("relative", className)}>
      {children}
      {resizable && (
        <span
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className={cn(
            "absolute top-0 right-0 z-10 h-full w-2 -translate-x-1/2 cursor-col-resize touch-none select-none",
            dragging && "bg-primary/40"
          )}
        />
      )}
    </TableHead>
  );
}
