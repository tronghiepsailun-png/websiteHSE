"use server";

import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOrgPermission } from "@/server/api-guard";
import { PERMISSIONS } from "@/server/permissions";
import { createInventoryItem, updateInventoryItem, setInventoryItemActive } from "@/server/inventory";
import { writeAuditLog } from "@/server/audit";
import { getLocale } from "@/lib/i18n/get-locale.server";
import { t } from "@/lib/i18n/translate";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80) || "image";
}

/** Item photos are generic, non-sensitive equipment reference images (same as the seeded
 *  set), so — unlike the org-scoped private documents in storageService — they live as
 *  plain static files under public/inventory, served directly with no auth/download route. */
async function saveInventoryImage(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const fileName = `${randomUUID()}-${sanitizeFileName(file.name)}`;
  const dir = path.join(process.cwd(), "public", "inventory");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, fileName), buffer);
  return `/inventory/${fileName}`;
}

function revalidateInventoryPaths() {
  revalidatePath("/inventory/catalog");
  revalidatePath("/inventory");
}

export type ItemFormState = { error: string } | { success: true } | undefined;

const itemSchema = z.object({
  name: z.string().min(1).max(200),
  nameZh: z.string().optional(),
  unit: z.string().min(1).max(30),
  minStockLevel: z.coerce.number().int().min(0),
});

export async function createInventoryItemAction(_prev: ItemFormState, formData: FormData): Promise<ItemFormState> {
  const ctx = await requireOrgPermission(PERMISSIONS.INVENTORY_EDIT);
  const locale = await getLocale();

  const parsed = itemSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: t(locale, "inventory.form.errorGeneric") };
  const data = parsed.data;

  const file = formData.get("image");
  let imageUrl: string | null = null;
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_IMAGE_BYTES) return { error: t(locale, "inventory.catalog.errorImageTooLarge") };
    if (!IMAGE_TYPES.has(file.type)) return { error: t(locale, "inventory.catalog.errorImageType") };
    imageUrl = await saveInventoryImage(file);
  }

  const created = await createInventoryItem({
    organizationId: ctx.organizationId,
    name: data.name.trim(),
    nameZh: data.nameZh?.trim() || null,
    unit: data.unit.trim(),
    minStockLevel: data.minStockLevel,
    imageUrl,
  });

  await writeAuditLog({ organizationId: ctx.organizationId, userId: ctx.userId, module: "inventory", recordType: "InventoryItem", recordId: created.id, action: "create" });

  revalidateInventoryPaths();
  return { success: true };
}

export async function updateInventoryItemAction(_prev: ItemFormState, formData: FormData): Promise<ItemFormState> {
  const ctx = await requireOrgPermission(PERMISSIONS.INVENTORY_EDIT);
  const locale = await getLocale();

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: t(locale, "inventory.form.errorGeneric") };

  const parsed = itemSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: t(locale, "inventory.form.errorGeneric") };
  const data = parsed.data;

  const file = formData.get("image");
  let imageUrl: string | undefined = undefined;
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_IMAGE_BYTES) return { error: t(locale, "inventory.catalog.errorImageTooLarge") };
    if (!IMAGE_TYPES.has(file.type)) return { error: t(locale, "inventory.catalog.errorImageType") };
    imageUrl = await saveInventoryImage(file);
  }

  await updateInventoryItem(ctx.organizationId, id, {
    name: data.name.trim(),
    nameZh: data.nameZh?.trim() || null,
    unit: data.unit.trim(),
    minStockLevel: data.minStockLevel,
    ...(imageUrl ? { imageUrl } : {}),
  });

  await writeAuditLog({ organizationId: ctx.organizationId, userId: ctx.userId, module: "inventory", recordType: "InventoryItem", recordId: id, action: "update" });

  revalidateInventoryPaths();
  return { success: true };
}

export async function toggleInventoryItemActiveAction(formData: FormData) {
  const ctx = await requireOrgPermission(PERMISSIONS.INVENTORY_EDIT);
  const id = String(formData.get("id"));
  const nextIsActive = formData.get("isActive") === "true";

  await setInventoryItemActive(ctx.organizationId, id, nextIsActive);

  await writeAuditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    module: "inventory",
    recordType: "InventoryItem",
    recordId: id,
    action: "update",
    changes: [{ field: "isActive", oldValue: String(!nextIsActive), newValue: String(nextIsActive) }],
  });

  revalidateInventoryPaths();
}
