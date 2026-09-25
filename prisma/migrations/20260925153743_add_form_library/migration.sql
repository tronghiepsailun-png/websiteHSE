-- CreateTable
CREATE TABLE "form_templates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "code" TEXT,
    "nameVi" TEXT NOT NULL,
    "nameZh" TEXT,
    "descriptionVi" TEXT,
    "descriptionZh" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "form_templates_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "form_templates_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "catalog_items" ("id") ON DELETE NO ACTION ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "form_templates_organizationId_categoryId_idx" ON "form_templates"("organizationId", "categoryId");

-- Seed each organization's form-library categories (editable afterwards from the library's
-- "Danh muc" page). Insert-only into catalog_items; nothing existing is read or changed.
INSERT INTO "catalog_items" ("id", "organizationId", "module", "kind", "nameVi", "nameZh", "sortOrder", "isActive")
SELECT lower(hex(randomblob(16))), o."id", 'forms', 'category', c."nameVi", c."nameZh", c."sortOrder", 1
FROM "organizations" o
CROSS JOIN (
  SELECT 'Đào tạo' AS "nameVi", '培训' AS "nameZh", 0 AS "sortOrder"
  UNION ALL SELECT 'PCCC', '消防', 1
  UNION ALL SELECT 'Sự cố', '事故', 2
  UNION ALL SELECT 'Vi phạm', '违规', 3
  UNION ALL SELECT 'Mua hàng', '采购', 4
  UNION ALL SELECT 'Môi trường', '环境', 5
  UNION ALL SELECT 'Nghiệm thu', '验收', 6
  UNION ALL SELECT 'Khác', '其他', 7
) c;
