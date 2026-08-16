"use server";

import { revalidatePath } from "next/cache";
import { requireOrgPermission } from "@/server/api-guard";
import { PERMISSIONS } from "@/server/permissions";
import { previewEmployeeImport, commitEmployeeImport } from "@/server/employee-import";
import type { ClassifiedEmployeeRow, EmployeeImportCommitResult, EmployeeImportPreview } from "@/server/employee-import-shared";
import { getLocale } from "@/lib/i18n/get-locale.server";
import { t } from "@/lib/i18n/translate";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const MAX_IMPORT_SIZE_BYTES = 25 * 1024 * 1024;

export type PreviewActionState = { error: string } | { preview: EmployeeImportPreview } | undefined;

export async function previewEmployeeImportAction(_prev: PreviewActionState, formData: FormData): Promise<PreviewActionState> {
  const ctx = await requireOrgPermission(PERMISSIONS.EMPLOYEE_MANAGE);
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
  const preview = await previewEmployeeImport({ organizationId: ctx.organizationId, buffer });

  return { preview };
}

export async function confirmEmployeeImportAction(
  rows: ClassifiedEmployeeRow[],
  departedEmployeeCodes: string[]
): Promise<EmployeeImportCommitResult> {
  const ctx = await requireOrgPermission(PERMISSIONS.EMPLOYEE_MANAGE);

  const result = await commitEmployeeImport({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    rows,
    departedEmployeeCodes,
  });

  revalidatePath("/employees");
  return result;
}
