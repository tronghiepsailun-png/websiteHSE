/*
  Warnings:

  - You are about to drop the column `createdById` on the `work_plan_items` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `work_plan_items` table. All the data in the column will be lost.
  - You are about to drop the column `dueDate` on the `work_plan_items` table. All the data in the column will be lost.
  - You are about to drop the column `linkedIncidentId` on the `work_plan_items` table. All the data in the column will be lost.
  - You are about to drop the column `notes` on the `work_plan_items` table. All the data in the column will be lost.
  - You are about to drop the column `orgUnitId` on the `work_plan_items` table. All the data in the column will be lost.
  - You are about to drop the column `organizationId` on the `work_plan_items` table. All the data in the column will be lost.
  - You are about to drop the column `priority` on the `work_plan_items` table. All the data in the column will be lost.
  - You are about to drop the column `responsiblePersonId` on the `work_plan_items` table. All the data in the column will be lost.
  - Added the required column `documentId` to the `work_plan_items` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "work_plan_documents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "work_plan_documents_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "work_plan_documents_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_work_plan_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "phase" TEXT,
    "title" TEXT NOT NULL,
    "responsibleName" TEXT,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'not_started',
    "progressPercent" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "work_plan_items_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "work_plan_documents" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_work_plan_items" ("createdAt", "id", "startDate", "status", "title", "updatedAt") SELECT "createdAt", "id", "startDate", "status", "title", "updatedAt" FROM "work_plan_items";
DROP TABLE "work_plan_items";
ALTER TABLE "new_work_plan_items" RENAME TO "work_plan_items";
CREATE INDEX "work_plan_items_documentId_sortOrder_idx" ON "work_plan_items"("documentId", "sortOrder");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "work_plan_documents_organizationId_idx" ON "work_plan_documents"("organizationId");
