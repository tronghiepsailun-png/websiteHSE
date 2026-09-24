-- CreateTable
CREATE TABLE "catalog_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "nameVi" TEXT NOT NULL,
    "nameZh" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "catalog_items_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "catalog_items_organizationId_module_kind_idx" ON "catalog_items"("organizationId", "module", "kind");

-- Seed CAPA's two dropdowns (Khu vuc / Bo phan phu trach) with a one-time COPY of each
-- organization's current workshop list, so the dropdowns look exactly as before and can then be
-- edited freely without touching the shared safety_workshops table. Read-only against
-- safety_workshops; only inserts into the new table above.
INSERT INTO "catalog_items" ("id", "organizationId", "module", "kind", "nameVi", "nameZh", "sortOrder", "isActive")
SELECT lower(hex(randomblob(16))), "organizationId", 'capa', 'area', COALESCE("nameVi", "name"), "name", "sortOrder", "isActive"
FROM "safety_workshops";

INSERT INTO "catalog_items" ("id", "organizationId", "module", "kind", "nameVi", "nameZh", "sortOrder", "isActive")
SELECT lower(hex(randomblob(16))), "organizationId", 'capa', 'dept', COALESCE("nameVi", "name"), "name", "sortOrder", "isActive"
FROM "safety_workshops";
