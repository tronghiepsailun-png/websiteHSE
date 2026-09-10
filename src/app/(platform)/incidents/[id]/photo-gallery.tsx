"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, X, Square, LayoutGrid } from "lucide-react";
import { deleteIncidentAttachmentAction } from "./actions";
import { Button } from "@/components/ui/button";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import { useT } from "@/lib/i18n/locale-context";

export type PhotoDoc = { id: string; fileName: string };

function PhotoTile({
  doc,
  incidentId,
  canDelete,
  deleteLabel,
}: {
  doc: PhotoDoc;
  incidentId: string;
  canDelete: boolean;
  deleteLabel: string;
}) {
  const src = `/api/documents/${doc.id}`;
  return (
    <div className="group relative aspect-square overflow-hidden rounded-lg border">
      <ImageLightbox src={src} alt={doc.fileName} className="absolute inset-0 block size-full">
        <img src={src} alt={doc.fileName} className="size-full object-cover" />
      </ImageLightbox>
      {canDelete && (
        <form action={deleteIncidentAttachmentAction} className="absolute top-1.5 right-1.5">
          <input type="hidden" name="documentId" value={doc.id} />
          <input type="hidden" name="incidentId" value={incidentId} />
          <Button
            type="submit"
            size="icon"
            variant="secondary"
            className="size-7 opacity-0 transition-opacity group-hover:opacity-100"
            title={deleteLabel}
          >
            <X className="size-4" />
          </Button>
        </form>
      )}
    </div>
  );
}

export function IncidentPhotoGallery({
  photos,
  incidentId,
  canDelete,
}: {
  photos: PhotoDoc[];
  incidentId: string;
  canDelete: boolean;
}) {
  const t = useT();
  const [mode, setMode] = useState<"single" | "grid">("single");
  const [index, setIndex] = useState(0);

  if (photos.length === 0) return null;

  const safeIndex = Math.min(index, photos.length - 1);

  return (
    <div className="flex flex-col gap-2">
      {photos.length > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {safeIndex + 1}/{photos.length}
          </span>
          <div className="flex gap-1">
            <Button
              type="button"
              size="icon-sm"
              variant={mode === "single" ? "secondary" : "ghost"}
              onClick={() => setMode("single")}
              title={t("incidents.detail.photoViewSingle")}
            >
              <Square className="size-3.5" />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant={mode === "grid" ? "secondary" : "ghost"}
              onClick={() => setMode("grid")}
              title={t("incidents.detail.photoViewGrid")}
            >
              <LayoutGrid className="size-3.5" />
            </Button>
          </div>
        </div>
      )}

      {mode === "single" ? (
        <div className="relative">
          <PhotoTile doc={photos[safeIndex]} incidentId={incidentId} canDelete={canDelete} deleteLabel={t("common.delete")} />
          {photos.length > 1 && (
            <>
              <Button
                type="button"
                size="icon-sm"
                variant="secondary"
                className="absolute top-1/2 left-1.5 -translate-y-1/2 rounded-full opacity-80 hover:opacity-100"
                onClick={() => setIndex((safeIndex - 1 + photos.length) % photos.length)}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                type="button"
                size="icon-sm"
                variant="secondary"
                className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-full opacity-80 hover:opacity-100"
                onClick={() => setIndex((safeIndex + 1) % photos.length)}
              >
                <ChevronRight className="size-4" />
              </Button>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {photos.map((doc) => (
            <PhotoTile key={doc.id} doc={doc} incidentId={incidentId} canDelete={canDelete} deleteLabel={t("common.delete")} />
          ))}
        </div>
      )}
    </div>
  );
}
