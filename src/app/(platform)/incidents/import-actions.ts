"use server";

import { revalidatePath } from "next/cache";
import { requireOrgPermission } from "@/server/api-guard";
import { PERMISSIONS } from "@/server/permissions";
import { importIncidentsFromExcel, type ImportResult } from "@/server/incident-import";
import { getLocale } from "@/lib/i18n/get-locale.server";
import { t } from "@/lib/i18n/translate";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const MAX_IMPORT_SIZE_BYTES = 25 * 1024 * 1024;

export type ImportActionState = { error: string } | { result: ImportResult } | undefined;

export async function importIncidentsAction(_prev: ImportActionState, formData: FormData): Promise<ImportActionState> {
  const ctx = await requireOrgPermission(PERMISSIONS.INCIDENT_CREATE);
  const locale = await getLocale();
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return { error: t(locale, "incidents.upload.noFile") };
  }
  const looksLikeXlsx = file.type === XLSX_MIME || file.name.toLowerCase().endsWith(".xlsx");
  if (!looksLikeXlsx) {
    return { error: t(locale, "incidents.upload.invalidFileType") };
  }
  if (file.size > MAX_IMPORT_SIZE_BYTES) {
    return { error: t(locale, "incidents.upload.invalidFileType") };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await importIncidentsFromExcel({ organizationId: ctx.organizationId, userId: ctx.userId, buffer });

  if (result.ok && result.created > 0) {
    revalidatePath("/incidents");
  }

  return { result };
}
