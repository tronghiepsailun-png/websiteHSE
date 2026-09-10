import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/server/errors";
import { storageService, MAX_UPLOAD_SIZE_BYTES } from "@/server/storage";
import type { Locale } from "@/lib/i18n/translate";

export { INVENTORY_TRANSACTION_TYPES, type InventoryTransactionType, MAX_INVENTORY_TRANSACTION_PHOTOS } from "@/lib/inventory-constants";
const INVENTORY_TRANSACTION_PHOTO_MODULE = "inventory-transaction";

/** Photos captured at the moment of a stock in/out (the paper Xuất/Lãnh or Nhập kho slip) —
 *  kept as evidence for that transaction, same polymorphic Document store incidents use. */
export async function attachInventoryTransactionPhotos(organizationId: string, transactionId: string, uploadedById: string, files: File[]) {
  for (const file of files) {
    if (file.size === 0 || file.size > MAX_UPLOAD_SIZE_BYTES || !file.type.startsWith("image/")) continue;
    const buffer = Buffer.from(await file.arrayBuffer());
    const { storagePath } = await storageService.save({
      organizationId,
      module: INVENTORY_TRANSACTION_PHOTO_MODULE,
      recordId: transactionId,
      fileName: file.name,
      buffer,
    });
    await prisma.document.create({
      data: {
        organizationId,
        module: INVENTORY_TRANSACTION_PHOTO_MODULE,
        recordId: transactionId,
        fileName: file.name,
        fileType: file.type,
        sizeBytes: buffer.length,
        storageProvider: "local",
        storagePath,
        uploadedById,
      },
    });
  }
}

function computeStock(transactions: { type: string; quantity: number }[]) {
  return transactions.reduce((sum, tx) => sum + (tx.type === "in" ? tx.quantity : -tx.quantity), 0);
}

export function isLowStock(item: { stock: number; minStockLevel: number }) {
  return item.stock < item.minStockLevel;
}

// Small closed set of units used across the equipment catalog — not worth a DB column.
const UNIT_ZH: Record<string, string> = { Cái: "个", Cuộn: "卷", Tấm: "块", Bộ: "套", Đôi: "双" };

export function localizeInventoryItem<T extends { name: string; nameZh?: string | null; unit?: string }>(item: T, locale: Locale): T {
  if (locale !== "zh") return item;
  return { ...item, name: item.nameZh || item.name, unit: item.unit ? (UNIT_ZH[item.unit] ?? item.unit) : item.unit };
}

/** All active items for the org, each with its live-computed stock (never cached — always
 *  SUM(in) - SUM(out) at query time, same pattern as records/attendance/work-plan status). */
export async function listInventoryItemsWithStock(organizationId: string) {
  const items = await prisma.inventoryItem.findMany({
    where: { organizationId, isActive: true },
    orderBy: { sortOrder: "asc" },
    include: { transactions: { select: { type: true, quantity: true } } },
  });
  return items.map(({ transactions, ...item }) => ({ ...item, stock: computeStock(transactions) }));
}

export async function getInventoryItem(organizationId: string, id: string) {
  const item = await prisma.inventoryItem.findUnique({ where: { id }, include: { transactions: { select: { type: true, quantity: true } } } });
  if (!item || item.organizationId !== organizationId) throw new NotFoundError("Inventory item not found");
  const { transactions, ...rest } = item;
  return { ...rest, stock: computeStock(transactions) };
}

export type InventoryTransactionFilter = {
  type?: string;
  itemId?: string;
  department?: string;
  excludeAdjustments?: boolean;
};

export async function listInventoryTransactions(organizationId: string, filter: InventoryTransactionFilter = {}) {
  const transactions = await prisma.inventoryTransaction.findMany({
    where: {
      organizationId,
      ...(filter.type ? { type: filter.type } : {}),
      ...(filter.itemId ? { itemId: filter.itemId } : {}),
      ...(filter.department ? { department: { contains: filter.department } } : {}),
      ...(filter.excludeAdjustments ? { isAdjustment: false } : {}),
    },
    include: {
      item: true,
      recordedBy: { select: { name: true } },
      recipientEmployee: { select: { id: true, employeeCode: true, fullName: true, fullNameZh: true } },
    },
    orderBy: { transactionDate: "desc" },
  });

  // Document is polymorphic (module + recordId), not a direct Prisma relation — one extra
  // query for every transaction's attached slip photos, grouped back onto each row in JS.
  const documents = await prisma.document.findMany({
    where: { organizationId, module: INVENTORY_TRANSACTION_PHOTO_MODULE, recordId: { in: transactions.map((tx) => tx.id) } },
    orderBy: { uploadedAt: "asc" },
  });
  const photosByTxId = new Map<string, { id: string; fileName: string }[]>();
  for (const doc of documents) {
    const list = photosByTxId.get(doc.recordId) ?? [];
    list.push({ id: doc.id, fileName: doc.fileName });
    photosByTxId.set(doc.recordId, list);
  }

  return transactions.map((tx) => ({ ...tx, photos: photosByTxId.get(tx.id) ?? [] }));
}

export async function createInventoryTransaction(params: {
  organizationId: string;
  itemId: string;
  type: "in" | "out";
  quantity: number;
  department?: string | null;
  recipientEmployeeId?: string | null;
  note?: string | null;
  transactionDate: Date;
  recordedById: string;
  isAdjustment?: boolean;
}) {
  const item = await prisma.inventoryItem.findUnique({ where: { id: params.itemId } });
  if (!item || item.organizationId !== params.organizationId) throw new NotFoundError("Inventory item not found");

  if (params.recipientEmployeeId) {
    const employee = await prisma.employee.findUnique({ where: { id: params.recipientEmployeeId } });
    if (!employee || employee.organizationId !== params.organizationId) throw new NotFoundError("Employee not found");
  }

  return prisma.inventoryTransaction.create({
    data: {
      organizationId: params.organizationId,
      itemId: params.itemId,
      type: params.type,
      quantity: params.quantity,
      department: params.department || null,
      recipientEmployeeId: params.recipientEmployeeId || null,
      note: params.note || null,
      transactionDate: params.transactionDate,
      recordedById: params.recordedById,
      isAdjustment: params.isAdjustment ?? false,
    },
  });
}

export async function getInventoryTransaction(organizationId: string, id: string) {
  const tx = await prisma.inventoryTransaction.findUnique({
    where: { id },
    include: { recipientEmployee: { select: { id: true, employeeCode: true, fullName: true, fullNameZh: true } } },
  });
  if (!tx || tx.organizationId !== organizationId) throw new NotFoundError("Inventory transaction not found");
  return tx;
}

export async function updateInventoryTransaction(
  organizationId: string,
  id: string,
  params: {
    quantity: number;
    department?: string | null;
    recipientEmployeeId?: string | null;
    note?: string | null;
    transactionDate: Date;
  }
) {
  const tx = await prisma.inventoryTransaction.findUnique({ where: { id } });
  if (!tx || tx.organizationId !== organizationId) throw new NotFoundError("Inventory transaction not found");

  if (tx.type === "out") {
    const item = await getInventoryItem(organizationId, tx.itemId);
    const availableIncludingThisTx = item.stock + tx.quantity;
    if (params.quantity > availableIncludingThisTx) {
      return { error: "insufficient_stock" as const, available: availableIncludingThisTx };
    }
  }

  if (params.recipientEmployeeId) {
    const employee = await prisma.employee.findUnique({ where: { id: params.recipientEmployeeId } });
    if (!employee || employee.organizationId !== organizationId) throw new NotFoundError("Employee not found");
  }

  const updated = await prisma.inventoryTransaction.update({
    where: { id },
    data: {
      quantity: params.quantity,
      department: params.department || null,
      recipientEmployeeId: params.recipientEmployeeId || null,
      note: params.note || null,
      transactionDate: params.transactionDate,
    },
  });
  return { error: undefined, transaction: updated };
}

export async function deleteInventoryTransaction(organizationId: string, id: string) {
  const tx = await prisma.inventoryTransaction.findUnique({ where: { id } });
  if (!tx || tx.organizationId !== organizationId) throw new NotFoundError("Inventory transaction not found");
  await prisma.inventoryTransaction.delete({ where: { id } });
}

/** Active workshops/departments for the "Bộ phận lãnh" picker on the Xuất/Lãnh form —
 *  reuses the same canonical list the incident-report module already maintains. */
export async function listActiveSafetyWorkshops(organizationId: string) {
  return prisma.safetyWorkshop.findMany({ where: { organizationId, isActive: true }, orderBy: { sortOrder: "asc" } });
}

/** Total quantity issued (out) per item — feeds the "Báo lãnh" chart. Only items with at
 *  least one issuance are returned, sorted most-issued first. */
export async function getIssuanceTotalsByItem(organizationId: string, filter: { department?: string } = {}) {
  const items = await prisma.inventoryItem.findMany({
    where: { organizationId },
    orderBy: { sortOrder: "asc" },
    include: {
      transactions: {
        where: { type: "out", isAdjustment: false, ...(filter.department ? { department: { contains: filter.department } } : {}) },
        select: { quantity: true },
      },
    },
  });
  return items
    .map(({ transactions, ...item }) => ({ ...item, totalIssued: transactions.reduce((sum, tx) => sum + tx.quantity, 0) }))
    .filter((item) => item.totalIssued > 0)
    .sort((a, b) => b.totalIssued - a.totalIssued);
}

/** Total quantity received (in) per item — feeds the "Nhập kho" chart, mirroring
 *  getIssuanceTotalsByItem above. */
export async function getStockInTotalsByItem(organizationId: string) {
  const items = await prisma.inventoryItem.findMany({
    where: { organizationId },
    orderBy: { sortOrder: "asc" },
    include: {
      transactions: {
        where: { type: "in", isAdjustment: false },
        select: { quantity: true },
      },
    },
  });
  return items
    .map(({ transactions, ...item }) => ({ ...item, totalReceived: transactions.reduce((sum, tx) => sum + tx.quantity, 0) }))
    .filter((item) => item.totalReceived > 0)
    .sort((a, b) => b.totalReceived - a.totalReceived);
}

export async function getInventoryDashboardData(organizationId: string) {
  const items = await listInventoryItemsWithStock(organizationId);
  const lowStockItems = items.filter(isLowStock);
  return { items, totalItems: items.length, lowStockCount: lowStockItems.length };
}

/** Every item regardless of isActive — for the catalog admin screen only. */
export async function listAllInventoryItems(organizationId: string) {
  return prisma.inventoryItem.findMany({ where: { organizationId }, orderBy: { sortOrder: "asc" } });
}

export async function getNextInventoryItemSortOrder(organizationId: string) {
  const last = await prisma.inventoryItem.findFirst({ where: { organizationId }, orderBy: { sortOrder: "desc" } });
  return (last?.sortOrder ?? -1) + 1;
}

export async function createInventoryItem(params: {
  organizationId: string;
  name: string;
  nameZh?: string | null;
  unit: string;
  imageUrl?: string | null;
  minStockLevel: number;
}) {
  const sortOrder = await getNextInventoryItemSortOrder(params.organizationId);
  return prisma.inventoryItem.create({ data: { ...params, sortOrder } });
}

export async function updateInventoryItem(
  organizationId: string,
  id: string,
  params: { name: string; nameZh?: string | null; unit: string; imageUrl?: string | null; minStockLevel: number }
) {
  const item = await prisma.inventoryItem.findUnique({ where: { id } });
  if (!item || item.organizationId !== organizationId) throw new NotFoundError("Inventory item not found");
  return prisma.inventoryItem.update({ where: { id }, data: params });
}

export async function setInventoryItemActive(organizationId: string, id: string, isActive: boolean) {
  const item = await prisma.inventoryItem.findUnique({ where: { id } });
  if (!item || item.organizationId !== organizationId) throw new NotFoundError("Inventory item not found");
  return prisma.inventoryItem.update({ where: { id }, data: { isActive } });
}
