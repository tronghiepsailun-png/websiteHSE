import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { storageService, dispositionFor } from "@/server/storage";
import { withApiErrorHandling, requireApiAccess } from "@/server/api-guard";
import { PERMISSIONS } from "@/server/permissions";
import { NotFoundError } from "@/server/errors";

export async function GET(_request: Request, context: RouteContext<"/api/records/slot-files/[id]">) {
  return withApiErrorHandling(async () => {
    const ctx = await requireApiAccess(PERMISSIONS.RECORDS_VIEW);
    const { id } = await context.params;

    const slot = await prisma.recordEntrySlot.findUnique({ where: { id }, include: { entry: true } });
    if (!slot || slot.entry.organizationId !== ctx.organizationId) throw new NotFoundError();
    if (slot.storageType !== "upload" || !slot.storagePath) throw new NotFoundError();

    const buffer = await storageService.read(slot.storagePath);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": slot.mimeType || "application/octet-stream",
        "Content-Disposition": dispositionFor(slot.fileName ?? "file", slot.mimeType),
        "Content-Length": String(slot.sizeBytes ?? buffer.length),
      },
    });
  });
}
