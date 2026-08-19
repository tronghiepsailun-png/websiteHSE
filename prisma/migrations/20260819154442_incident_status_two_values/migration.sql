-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_incidents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "incidentNumber" TEXT NOT NULL,
    "occurredAt" DATETIME NOT NULL,
    "reportedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "orgUnitId" TEXT,
    "locationDetail" TEXT,
    "equipment" TEXT,
    "employeeId" TEXT,
    "employeeNameSnapshot" TEXT,
    "employeeCodeSnapshot" TEXT,
    "departmentSnapshot" TEXT,
    "positionSnapshot" TEXT,
    "shiftSnapshot" TEXT,
    "categoryId" TEXT NOT NULL,
    "severityId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "immediateCause" TEXT,
    "rootCause" TEXT,
    "correctiveAction" TEXT,
    "preventiveAction" TEXT,
    "responsiblePersonId" TEXT,
    "responsiblePersonNameSnapshot" TEXT,
    "dueDate" DATETIME,
    "completionDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'investigating',
    "cost" REAL,
    "notes" TEXT,
    "costRmb" REAL,
    "costVnd" REAL,
    "pointsDeducted" REAL,
    "injuredBodyPart" TEXT,
    "sourceRowData" JSONB,
    "reportedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "incidents_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "incidents_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "org_units" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "incidents_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "incidents_responsiblePersonId_fkey" FOREIGN KEY ("responsiblePersonId") REFERENCES "employees" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "incidents_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "incident_categories" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "incidents_severityId_fkey" FOREIGN KEY ("severityId") REFERENCES "incident_severities" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "incidents_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_incidents" ("categoryId", "completionDate", "correctiveAction", "cost", "costRmb", "costVnd", "createdAt", "departmentSnapshot", "description", "dueDate", "employeeCodeSnapshot", "employeeId", "employeeNameSnapshot", "equipment", "id", "immediateCause", "incidentNumber", "injuredBodyPart", "locationDetail", "notes", "occurredAt", "orgUnitId", "organizationId", "pointsDeducted", "positionSnapshot", "preventiveAction", "reportedAt", "reportedById", "responsiblePersonId", "responsiblePersonNameSnapshot", "rootCause", "severityId", "shiftSnapshot", "sourceRowData", "status", "updatedAt") SELECT "categoryId", "completionDate", "correctiveAction", "cost", "costRmb", "costVnd", "createdAt", "departmentSnapshot", "description", "dueDate", "employeeCodeSnapshot", "employeeId", "employeeNameSnapshot", "equipment", "id", "immediateCause", "incidentNumber", "injuredBodyPart", "locationDetail", "notes", "occurredAt", "orgUnitId", "organizationId", "pointsDeducted", "positionSnapshot", "preventiveAction", "reportedAt", "reportedById", "responsiblePersonId", "responsiblePersonNameSnapshot", "rootCause", "severityId", "shiftSnapshot", "sourceRowData", "status", "updatedAt" FROM "incidents";
DROP TABLE "incidents";
ALTER TABLE "new_incidents" RENAME TO "incidents";
CREATE INDEX "incidents_organizationId_status_idx" ON "incidents"("organizationId", "status");
CREATE INDEX "incidents_organizationId_severityId_idx" ON "incidents"("organizationId", "severityId");
CREATE INDEX "incidents_organizationId_occurredAt_idx" ON "incidents"("organizationId", "occurredAt");
CREATE UNIQUE INDEX "incidents_organizationId_incidentNumber_key" ON "incidents"("organizationId", "incidentNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
