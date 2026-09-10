-- CreateTable
CREATE TABLE "safety_5s_violations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "periodYear" INTEGER NOT NULL,
    "periodMonth" INTEGER NOT NULL,
    "employeeId" TEXT,
    "employeeCodeSnapshot" TEXT,
    "fullNameZhSnapshot" TEXT,
    "fullNameViSnapshot" TEXT NOT NULL,
    "orgUnitLevel1Snapshot" TEXT,
    "regionSnapshot" TEXT,
    "orgUnitLevel2Snapshot" TEXT,
    "teamSnapshot" TEXT,
    "shiftSnapshot" TEXT,
    "positionSnapshot" TEXT,
    "violationContent" TEXT NOT NULL,
    "violationDate" DATETIME NOT NULL,
    "fineAmountVnd" INTEGER,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "safety_5s_violations_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "safety_5s_violations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "safety_5s_violations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "safety_5s_violations_organizationId_periodYear_periodMonth_idx" ON "safety_5s_violations"("organizationId", "periodYear", "periodMonth");
