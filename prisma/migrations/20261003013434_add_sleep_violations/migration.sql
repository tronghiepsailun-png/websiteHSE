-- AlterTable
ALTER TABLE "catalog_items" ADD COLUMN "code" TEXT;
ALTER TABLE "catalog_items" ADD COLUMN "color" TEXT;

-- CreateTable
CREATE TABLE "sleep_violations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "periodYear" INTEGER NOT NULL,
    "periodMonth" INTEGER NOT NULL,
    "checkDate" DATETIME NOT NULL,
    "checkTime" TEXT,
    "location" TEXT,
    "employeeId" TEXT,
    "employeeCode" TEXT,
    "employeeName" TEXT NOT NULL,
    "factory" TEXT,
    "department" TEXT,
    "position" TEXT,
    "fineAmountVnd" INTEGER,
    "note" TEXT,
    "liableEmployeeId" TEXT,
    "liableCode" TEXT,
    "liableName" TEXT,
    "liableFineVnd" INTEGER,
    "guardCatalogId" TEXT,
    "guardCode" TEXT,
    "guardNameZh" TEXT,
    "guardNameVi" TEXT,
    "guardColor" TEXT,
    "guardRewardVnd" INTEGER,
    "remark" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "sleep_violations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "sleep_violations_organizationId_periodYear_periodMonth_idx" ON "sleep_violations"("organizationId", "periodYear", "periodMonth");
