"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** Wraps a single-row horizontally-scrolling strip (KPI cards, tab pills, chart bars...) with a
 *  bold, always-visible progress track underneath — native OS scrollbars are thin, often
 *  invisible-until-touched (especially on phones), and give no hint that swiping reveals more.
 *  This one is impossible to miss and shrinks/slides as the real content scrolls, so "there's
 *  more to the right" reads at a glance instead of needing to be discovered by accident. The
 *  track itself is a real scrollbar, not just a readout — clicking anywhere on it jumps the
 *  content there, and dragging scrubs it, for anyone on a mouse/trackpad who'd rather grab the
 *  bar than swipe the (often much taller) content above it. */
export function HorizontalScroll({
  children,
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ widthPct: number; leftPct: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    function update() {
      if (!el) return;
      const { scrollWidth, clientWidth, scrollLeft } = el;
      if (scrollWidth <= clientWidth + 1) {
        setThumb(null);
        return;
      }
      const widthPct = (clientWidth / scrollWidth) * 100;
      const leftPct = (scrollLeft / (scrollWidth - clientWidth)) * (100 - widthPct);
      setThumb({ widthPct, leftPct });
    }

    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, []);

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    const track = trackRef.current;
    if (!el || !track) return;
    e.preventDefault();
    track.setPointerCapture(e.pointerId);
    setDragging(true);

    function scrollToClientX(clientX: number) {
      const trackRect = track!.getBoundingClientRect();
      const { scrollWidth, clientWidth } = el!;
      const thumbWidthPx = (clientWidth / scrollWidth) * trackRect.width;
      const maxThumbLeft = Math.max(trackRect.width - thumbWidthPx, 0);
      // Center the thumb on the pointer, not its left edge, so grabbing anywhere along the
      // track — not just its start — feels like it's tracking the cursor.
      const rawLeft = clientX - trackRect.left - thumbWidthPx / 2;
      const clampedLeft = Math.min(Math.max(rawLeft, 0), maxThumbLeft);
      const scrollRatio = maxThumbLeft > 0 ? clampedLeft / maxThumbLeft : 0;
      el!.scrollLeft = scrollRatio * (scrollWidth - clientWidth);
    }

    scrollToClientX(e.clientX);

    function handleMove(ev: PointerEvent) {
      scrollToClientX(ev.clientX);
    }
    function handleUp(ev: PointerEvent) {
      track!.releasePointerCapture(ev.pointerId);
      track!.removeEventListener("pointermove", handleMove);
      track!.removeEventListener("pointerup", handleUp);
      setDragging(false);
    }
    track.addEventListener("pointermove", handleMove);
    track.addEventListener("pointerup", handleUp);
  }

  return (
    <div>
      <div ref={ref} className={cn("scrollbar-none overflow-x-auto", className)} {...rest}>
        {children}
      </div>
      {thumb && (
        // The padded outer div is the actual pointer target — taller than the bar it draws, so
        // there's a real hit area to grab with a mouse instead of a fiddly 6px-tall sliver.
        <div ref={trackRef} onPointerDown={handlePointerDown} className="mt-1.5 flex cursor-pointer touch-none items-center py-1.5 select-none">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full bg-primary transition-opacity", dragging ? "opacity-80" : "hover:opacity-90")}
              style={{ width: `${thumb.widthPct}%`, marginLeft: `${thumb.leftPct}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
