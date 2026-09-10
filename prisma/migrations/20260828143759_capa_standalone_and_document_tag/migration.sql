-- AlterTable
ALTER TABLE "documents" ADD COLUMN "tag" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_capa_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "sourceModule" TEXT,
    "sourceRecordId" TEXT,
    "action" TEXT NOT NULL,
    "rootCause" TEXT,
    "area" TEXT,
    "discoveredDate" DATETIME,
    "classification" TEXT,
    "responsiblePersonId" TEXT,
    "dueDate" DATETIME,
    "completionDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'open',
    "evidenceNotes" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "capa_items_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "capa_items_responsiblePersonId_fkey" FOREIGN KEY ("responsiblePersonId") REFERENCES "employees" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "capa_items_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_capa_items" ("action", "completionDate", "createdAt", "createdById", "dueDate", "evidenceNotes", "id", "organizationId", "responsiblePersonId", "rootCause", "sourceModule", "sourceRecordId", "status", "updatedAt") SELECT "action", "completionDate", "createdAt", "createdById", "dueDate", "evidenceNotes", "id", "organizationId", "responsiblePersonId", "rootCause", "sourceModule", "sourceRecordId", "status", "updatedAt" FROM "capa_items";
DROP TABLE "capa_items";
ALTER TABLE "new_capa_items" RENAME TO "capa_items";
CREATE INDEX "capa_items_organizationId_sourceModule_sourceRecordId_idx" ON "capa_items"("organizationId", "sourceModule", "sourceRecordId");
CREATE INDEX "capa_items_organizationId_status_idx" ON "capa_items"("organizationId", "status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
