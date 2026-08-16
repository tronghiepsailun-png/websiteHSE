import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { storageService } from "@/server/storage";
import { withApiErrorHandling, requireApiAccess } from "@/server/api-guard";
import { assertBelongsToOrg } from "@/server/org-context";

export async function GET(_request: Request, context: RouteContext<"/api/documents/[id]">) {
  return withApiErrorHandling(async () => {
    const ctx = await requireApiAccess(null);
    const { id } = await context.params;

    const doc = await prisma.document.findUnique({ where: { id } });
    assertBelongsToOrg(doc, ctx.organizationId);

    const buffer = await storageService.read(doc!.storagePath);
    const safeName = doc!.fileName.replace(/[\r\n"]/g, "_");

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": doc!.fileType || "application/octet-stream",
        "Content-Disposition": `inline; filename="${safeName}"`,
        "Content-Length": String(doc!.sizeBytes),
      },
    });
  });
}
