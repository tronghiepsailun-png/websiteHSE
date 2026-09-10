"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOrgPermission } from "@/server/api-guard";
import { PERMISSIONS } from "@/server/permissions";
import {
  createInventoryTransaction,
  getInventoryItem,
  updateInventoryTransaction,
  deleteInventoryTransaction,
  attachInventoryTransactionPhotos,
  MAX_INVENTORY_TRANSACTION_PHOTOS,
} from "@/server/inventory";
import { getLocale } from "@/lib/i18n/get-locale.server";
import { t } from "@/lib/i18n/translate";

export type TransactionFormState = { error: string } | { success: true } | undefined;

function getPhotoFiles(formData: FormData): File[] {
  return formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
}

const baseSchema = z.object({
  itemId: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
  transactionDate: z.string().min(1),
  note: z.string().optional(),
});

const outSchema = baseSchema.extend({
  department: z.string().min(1),
  recipientEmployeeId: z.string().optional(),
});

export async function createStockInAction(_prev: TransactionFormState, formData: FormData): Promise<TransactionFormState> {
  const ctx = await requireOrgPermission(PERMISSIONS.INVENTORY_EDIT);
  const locale = await getLocale();

  const parsed = baseSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: t(locale, "inventory.form.errorGeneric") };
  const data = parsed.data;

  const photos = getPhotoFiles(formData);
  if (photos.length > MAX_INVENTORY_TRANSACTION_PHOTOS) {
    return { error: t(locale, "inventory.form.errorTooManyPhotos", { max: MAX_INVENTORY_TRANSACTION_PHOTOS }) };
  }

  const tx = await createInventoryTransaction({
    organizationId: ctx.organizationId,
    itemId: data.itemId,
    type: "in",
    quantity: data.quantity,
    note: data.note,
    transactionDate: new Date(data.transactionDate),
    recordedById: ctx.userId,
  });
  if (photos.length) await attachInventoryTransactionPhotos(ctx.organizationId, tx.id, ctx.userId, photos);

  revalidatePath("/inventory");
  return { success: true };
}

const adjustSchema = z.object({
  itemId: z.string().min(1),
  actualQuantity: z.coerce.number().int().min(0),
  note: z.string().optional(),
});

/** Sets stock to an exact count (e.g. after a physical inventory check) — since stock is
 *  never stored directly (always SUM(in) - SUM(out)), this just records one adjustment
 *  transaction covering the gap between the current computed stock and the given count, so
 *  the change stays visible in the normal transaction history rather than silently
 *  overwriting a number. */
export async function adjustInventoryStockAction(_prev: TransactionFormState, formData: FormData): Promise<TransactionFormState> {
  const ctx = await requireOrgPermission(PERMISSIONS.INVENTORY_EDIT);
  const locale = await getLocale();

  const parsed = adjustSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: t(locale, "inventory.form.errorGeneric") };
  const data = parsed.data;

  const item = await getInventoryItem(ctx.organizationId, data.itemId);
  const delta = data.actualQuantity - item.stock;
  if (delta === 0) return { success: true };

  await createInventoryTransaction({
    organizationId: ctx.organizationId,
    itemId: data.itemId,
    type: delta > 0 ? "in" : "out",
    quantity: Math.abs(delta),
    note: data.note?.trim() || t(locale, "inventory.adjust.defaultNote"),
    transactionDate: new Date(),
    recordedById: ctx.userId,
    isAdjustment: true,
  });

  revalidatePath("/inventory");
  return { success: true };
}

const editOutSchema = z.object({
  id: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
  department: z.string().min(1),
  recipientEmployeeId: z.string().optional(),
  transactionDate: z.string().min(1),
  note: z.string().optional(),
});

export async function updateIssuanceTransactionAction(_prev: TransactionFormState, formData: FormData): Promise<TransactionFormState> {
  const ctx = await requireOrgPermission(PERMISSIONS.INVENTORY_EDIT);
  const locale = await getLocale();

  const parsed = editOutSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: t(locale, "inventory.form.errorGeneric") };
  const data = parsed.data;

  const result = await updateInventoryTransaction(ctx.organizationId, data.id, {
    quantity: data.quantity,
    department: data.department,
    recipientEmployeeId: data.recipientEmployeeId,
    note: data.note,
    transactionDate: new Date(data.transactionDate),
  });
  if (result.error) return { error: t(locale, "inventory.form.errorInsufficientStock", { available: result.available }) };

  revalidatePath("/inventory");
  return { success: true };
}

/** Shared by both the Báo lãnh (out) and Nhập kho (in) history tables — deletion doesn't
 *  depend on transaction type. */
export async function deleteInventoryTransactionAction(id: string) {
  const ctx = await requireOrgPermission(PERMISSIONS.INVENTORY_DELETE);
  await deleteInventoryTransaction(ctx.organizationId, id);
  revalidatePath("/inventory");
}

const editInSchema = z.object({
  id: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
  transactionDate: z.string().min(1),
  note: z.string().optional(),
});

export async function updateStockInTransactionAction(_prev: TransactionFormState, formData: FormData): Promise<TransactionFormState> {
  const ctx = await requireOrgPermission(PERMISSIONS.INVENTORY_EDIT);
  const locale = await getLocale();

  const parsed = editInSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: t(locale, "inventory.form.errorGeneric") };
  const data = parsed.data;

  const result = await updateInventoryTransaction(ctx.organizationId, data.id, {
    quantity: data.quantity,
    note: data.note,
    transactionDate: new Date(data.transactionDate),
  });
  if (result.error) return { error: t(locale, "inventory.form.errorInsufficientStock", { available: result.available }) };

  revalidatePath("/inventory");
  return { success: true };
}

export async function createStockOutAction(_prev: TransactionFormState, formData: FormData): Promise<TransactionFormState> {
  const ctx = await requireOrgPermission(PERMISSIONS.INVENTORY_EDIT);
  const locale = await getLocale();

  const parsed = outSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: t(locale, "inventory.form.errorGeneric") };
  const data = parsed.data;

  const item = await getInventoryItem(ctx.organizationId, data.itemId);
  if (item.stock < data.quantity) return { error: t(locale, "inventory.form.errorInsufficientStock", { available: item.stock }) };

  const photos = getPhotoFiles(formData);
  if (photos.length > MAX_INVENTORY_TRANSACTION_PHOTOS) {
    return { error: t(locale, "inventory.form.errorTooManyPhotos", { max: MAX_INVENTORY_TRANSACTION_PHOTOS }) };
  }

  const tx = await createInventoryTransaction({
    organizationId: ctx.organizationId,
    itemId: data.itemId,
    type: "out",
    quantity: data.quantity,
    department: data.department,
    recipientEmployeeId: data.recipientEmployeeId,
    note: data.note,
    transactionDate: new Date(data.transactionDate),
    recordedById: ctx.userId,
  });
  if (photos.length) await attachInventoryTransactionPhotos(ctx.organizationId, tx.id, ctx.userId, photos);

  revalidatePath("/inventory");
  return { success: true };
}
