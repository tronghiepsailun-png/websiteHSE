export const INVENTORY_TRANSACTION_TYPES = ["in", "out"] as const;
export type InventoryTransactionType = (typeof INVENTORY_TRANSACTION_TYPES)[number];

export const MAX_INVENTORY_TRANSACTION_PHOTOS = 2;
