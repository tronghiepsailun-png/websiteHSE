-- CreateTable
CREATE TABLE "work_plan_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "responsiblePersonId" TEXT,
    "orgUnitId" TEXT,
    "startDate" DATETIME,
    "dueDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'open',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "linkedIncidentId" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "work_plan_items_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "work_plan_items_responsiblePersonId_fkey" FOREIGN KEY ("responsiblePersonId") REFERENCES "employees" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "work_plan_items_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "org_units" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "work_plan_items_linkedIncidentId_fkey" FOREIGN KEY ("linkedIncidentId") REFERENCES "incidents" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "work_plan_items_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "work_plan_items_organizationId_status_idx" ON "work_plan_items"("organizationId", "status");

-- CreateIndex
CREATE INDEX "work_plan_items_organizationId_dueDate_idx" ON "work_plan_items"("organizationId", "dueDate");
