-- AlterTable
ALTER TABLE "incidents" ADD COLUMN "factoryCode" TEXT;

-- CreateTable
CREATE TABLE "safety_workshops" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "groupName" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "safety_workshops_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "department_aliases" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "safetyWorkshopId" TEXT,
    CONSTRAINT "department_aliases_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "department_aliases_safetyWorkshopId_fkey" FOREIGN KEY ("safetyWorkshopId") REFERENCES "safety_workshops" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "hse_yearly_targets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "safetyWorkshopId" TEXT,
    "year" INTEGER NOT NULL,
    "metricKey" TEXT NOT NULL,
    "value" REAL NOT NULL,
    CONSTRAINT "hse_yearly_targets_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "hse_yearly_targets_safetyWorkshopId_fkey" FOREIGN KEY ("safetyWorkshopId") REFERENCES "safety_workshops" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "safety_workshops_organizationId_code_key" ON "safety_workshops"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "department_aliases_organizationId_rawText_key" ON "department_aliases"("organizationId", "rawText");

-- CreateIndex
CREATE UNIQUE INDEX "hse_yearly_targets_organizationId_safetyWorkshopId_year_metricKey_key" ON "hse_yearly_targets"("organizationId", "safetyWorkshopId", "year", "metricKey");
