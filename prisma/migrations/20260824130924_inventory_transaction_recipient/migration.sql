-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_inventory_transactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "department" TEXT,
    "recipientEmployeeId" TEXT,
    "note" TEXT,
    "transactionDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "inventory_transactions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "inventory_transactions_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "inventory_transactions_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "inventory_transactions_recipientEmployeeId_fkey" FOREIGN KEY ("recipientEmployeeId") REFERENCES "employees" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_inventory_transactions" ("createdAt", "department", "id", "itemId", "note", "organizationId", "quantity", "recordedById", "transactionDate", "type") SELECT "createdAt", "department", "id", "itemId", "note", "organizationId", "quantity", "recordedById", "transactionDate", "type" FROM "inventory_transactions";
DROP TABLE "inventory_transactions";
ALTER TABLE "new_inventory_transactions" RENAME TO "inventory_transactions";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
