-- CreateTable
CREATE TABLE "work_injury_deductions" (
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
    "accidentDate" DATETIME,
    "reporterName" TEXT,
    "fineAmountVnd" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "work_injury_deductions_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "work_injury_deductions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "work_injury_deductions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "work_injury_deductions_organizationId_periodYear_periodMonth_idx" ON "work_injury_deductions"("organizationId", "periodYear", "periodMonth");
