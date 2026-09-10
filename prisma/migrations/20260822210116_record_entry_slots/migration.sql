-- CreateTable
CREATE TABLE "record_entry_slots" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entryId" TEXT NOT NULL,
    "slotIndex" INTEGER NOT NULL,
    "fileName" TEXT,
    "storageType" TEXT,
    "url" TEXT,
    "storagePath" TEXT,
    "sizeBytes" INTEGER,
    "mimeType" TEXT,
    "startDate" DATETIME,
    "expiresAt" DATETIME,
    "uploadedById" TEXT,
    "uploadedAt" DATETIME,
    CONSTRAINT "record_entry_slots_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "record_entries" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "record_entry_slots_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "record_entry_slots_entryId_slotIndex_key" ON "record_entry_slots"("entryId", "slotIndex");
