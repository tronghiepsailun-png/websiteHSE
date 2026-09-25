import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { storageService, contentDisposition, dispositionFor } from "@/server/storage";
import { withApiErrorHandling, requireApiAccess } from "@/server/api-guard";
import { PERMISSIONS } from "@/server/permissions";
import { assertBelongsToOrg } from "@/server/org-context";
import { FORMS_MODULE, ARCHIVED_TAG } from "@/server/forms";

/** Serves one form-library file. Unlike the generic /api/documents route this is gated by the
 *  library's own view permission, and `?download=1` forces a save-to-disk instead of letting the
 *  browser open a PDF/image inline. */
export async function GET(request: Request, context: RouteContext<"/api/forms/files/[id]">) {
  return withApiErrorHandling(async () => {
    const ctx = await requireApiAccess(PERMISSIONS.FORMS_VIEW);
    const { id } = await context.params;

    const doc = await prisma.document.findUnique({ where: { id } });
    assertBelongsToOrg(doc, ctx.organizationId);
    if (doc!.module !== FORMS_MODULE || doc!.tag === ARCHIVED_TAG) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const buffer = await storageService.read(doc!.storagePath);
    const forceDownload = new URL(request.url).searchParams.get("download") === "1";

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": doc!.fileType || "application/octet-stream",
        "Content-Disposition": forceDownload ? contentDisposition(doc!.fileName, "attachment") : dispositionFor(doc!.fileName, doc!.fileType),
        "Content-Length": String(buffer.length),
      },
    });
  });
}
