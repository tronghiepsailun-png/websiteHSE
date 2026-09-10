import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { storageService, dispositionFor } from "@/server/storage";
import { withApiErrorHandling, requireApiAccess } from "@/server/api-guard";
import { PERMISSIONS } from "@/server/permissions";
import { NotFoundError } from "@/server/errors";

export async function GET(_request: Request, context: RouteContext<"/api/records/files/[id]">) {
  return withApiErrorHandling(async () => {
    const ctx = await requireApiAccess(PERMISSIONS.RECORDS_VIEW);
    const { id } = await context.params;

    const file = await prisma.recordFile.findUnique({
      where: { id },
      include: { version: { include: { entry: true } } },
    });
    if (!file || file.version.entry.organizationId !== ctx.organizationId) throw new NotFoundError();
    if (file.storageType !== "upload" || !file.storagePath) throw new NotFoundError();

    const buffer = await storageService.read(file.storagePath);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": file.mimeType || "application/octet-stream",
        "Content-Disposition": dispositionFor(file.fileName, file.mimeType),
        "Content-Length": String(file.sizeBytes ?? buffer.length),
      },
    });
  });
}
