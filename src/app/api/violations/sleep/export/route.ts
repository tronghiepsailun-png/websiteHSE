import { NextResponse } from "next/server";
import { requireApiAccess, withApiErrorHandling } from "@/server/api-guard";
import { PERMISSIONS } from "@/server/permissions";
import { contentDisposition } from "@/server/storage";
import { buildSleepViolationWorkbook, listSleepViolations } from "@/server/sleep-violations";

export async function GET(request: Request) {
  return withApiErrorHandling(async () => {
    const ctx = await requireApiAccess(PERMISSIONS.VIOLATION_DOWNLOAD);
    const url = new URL(request.url);
    const now = new Date();
    const year = Number(url.searchParams.get("year")) || now.getFullYear();
    const month = Number(url.searchParams.get("month")) || now.getMonth() + 1;

    const rows = await listSleepViolations(ctx.organizationId, { year, month });
    const workbook = await buildSleepViolationWorkbook(rows, year, month);
    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer as ArrayBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": contentDisposition(`${month}月份夜班员工上班时间睡觉的名单.xlsx`, "attachment"),
      },
    });
  });
}
