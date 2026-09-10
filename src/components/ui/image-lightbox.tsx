"use client";

import { useState } from "react";
import { XIcon } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** A thumbnail that opens its full-size image in an in-app modal instead of navigating to the
 *  raw file URL — clicking a thumbnail used to open `/api/documents/<id>` directly (a full page
 *  navigation with no in-app close control: Escape did nothing, there was no X button, only the
 *  browser's own back/tab-close). Reuses the existing Dialog primitive, which already closes on
 *  Escape and on backdrop click. */
export function ImageLightbox({
  src,
  alt,
  size = 88,
  className,
  children,
  title,
}: {
  src: string;
  alt: string;
  size?: number;
  className?: string;
  /** Custom trigger content (e.g. an `<img>` that fills a grid tile via `absolute inset-0`, or
   *  an icon) — omit for the default fixed-size square thumbnail. */
  children?: React.ReactNode;
  /** Native hover tooltip on the trigger button (e.g. the file name). */
  title?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            title={title}
            className={cn(
              "cursor-zoom-in",
              !children && "block w-fit overflow-hidden rounded-md border transition-opacity hover:opacity-90",
              className
            )}
          />
        }
      >
        {children ?? (
          // eslint-disable-next-line @next/next/no-img-element -- served from our own /api/documents route, not an optimizable static asset
          <img src={src} alt={alt} width={size} height={size} style={{ width: size, height: size }} className="aspect-square object-cover" />
        )}
      </DialogTrigger>
      <DialogContent showCloseButton={false} className="max-w-3xl border-none bg-transparent p-0 ring-0">
        <DialogTitle className="sr-only">{alt}</DialogTitle>
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element -- served from our own /api/documents route, not an optimizable static asset */}
          <img src={src} alt={alt} className="max-h-[85vh] w-full rounded-lg object-contain" />
          <DialogClose
            render={
              <button
                type="button"
                className="absolute top-2 right-2 flex size-8 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
              />
            }
          >
            <XIcon className="size-4.5" />
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
