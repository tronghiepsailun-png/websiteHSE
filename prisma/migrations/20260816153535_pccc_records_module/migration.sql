
-- CreateTable
CREATE TABLE "record_domains" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    CONSTRAINT "record_domains_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "record_groups" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "domainId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "record_groups_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "record_domains" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "record_types" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalBasis" TEXT,
    "frequencyLabel" TEXT,
    "cycleMonths" INTEGER,
    "responsibleUnit" TEXT,
    "sharedAcrossSites" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "record_types_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "record_groups" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "record_entries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "recordTypeId" TEXT NOT NULL,
    "orgUnitId" TEXT NOT NULL,
    "responsiblePerson" TEXT,
    "notApplicable" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "record_entries_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "record_entries_recordTypeId_fkey" FOREIGN KEY ("recordTypeId") REFERENCES "record_types" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "record_entries_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "org_units" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "record_versions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entryId" TEXT NOT NULL,
    "effectiveDate" DATETIME,
    "dateSourceQuote" TEXT,
    "dateConfidence" TEXT NOT NULL,
    "expiresAt" DATETIME,
    "expiresAtIsManual" BOOLEAN NOT NULL DEFAULT false,
    "verificationStatus" TEXT NOT NULL DEFAULT 'ok',
    "notes" TEXT,
    "enteredById" TEXT,
    "enteredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isSuperseded" BOOLEAN NOT NULL DEFAULT false,
    "supersededById" TEXT,
    CONSTRAINT "record_versions_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "record_entries" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "record_versions_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "record_versions_supersededById_fkey" FOREIGN KEY ("supersededById") REFERENCES "record_versions" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "record_files" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "versionId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageType" TEXT NOT NULL,
    "url" TEXT,
    "storagePath" TEXT,
    "sizeBytes" INTEGER,
    "mimeType" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "uploadedById" TEXT,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "record_files_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "record_versions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "record_files_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "record_domains_organizationId_code_key" ON "record_domains"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "record_groups_domainId_code_key" ON "record_groups"("domainId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "record_types_groupId_code_key" ON "record_types"("groupId", "code");

-- CreateIndex
CREATE INDEX "record_entries_organizationId_idx" ON "record_entries"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "record_entries_recordTypeId_orgUnitId_key" ON "record_entries"("recordTypeId", "orgUnitId");

-- CreateIndex
CREATE UNIQUE INDEX "record_versions_supersededById_key" ON "record_versions"("supersededById");

-- CreateIndex
CREATE INDEX "record_versions_entryId_isSuperseded_idx" ON "record_versions"("entryId", "isSuperseded");

