import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiAccess, withApiErrorHandling } from "@/server/api-guard";
import { PERMISSIONS } from "@/server/permissions";
import { buildCapaReport, loadCapaReportItems } from "@/server/capa-report";
import { contentDisposition } from "@/server/storage";
import { exportFileName } from "@/lib/format";

const bodySchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(100),
  reporterName: z.string().trim().max(80).optional(),
});

export async function POST(request: Request) {
  return withApiErrorHandling(async () => {
    const ctx = await requireApiAccess(PERMISSIONS.CAPA_VIEW);

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

    const items = await loadCapaReportItems(ctx.organizationId, parsed.data.ids);
    if (items.length === 0) return NextResponse.json({ error: "No matching items" }, { status: 404 });

    const buffer = await buildCapaReport({ items, reporterName: parsed.data.reporterName || "" });
    const fileName = `${exportFileName("Báo cáo nguy hiểm tiềm ẩn")}.pptx`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": contentDisposition(fileName, "attachment"),
      },
    });
  });
}
