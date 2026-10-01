-- CreateTable
CREATE TABLE "shift_assignments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "team" TEXT NOT NULL,
    "effectiveFrom" DATETIME NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "shift_assignments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "shift_assignments_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "shift_assignments_organizationId_employeeId_effectiveFrom_key" ON "shift_assignments"("organizationId", "employeeId", "effectiveFrom");
