
-- AlterTable
ALTER TABLE "employees" ADD COLUMN "birthDate" DATETIME;
ALTER TABLE "employees" ADD COLUMN "costCenterName" TEXT;
ALTER TABLE "employees" ADD COLUMN "education" TEXT;
ALTER TABLE "employees" ADD COLUMN "fullNameZh" TEXT;
ALTER TABLE "employees" ADD COLUMN "gender" TEXT;
ALTER TABLE "employees" ADD COLUMN "nationalId" TEXT;
ALTER TABLE "employees" ADD COLUMN "orgUnitLevel1" TEXT;
ALTER TABLE "employees" ADD COLUMN "orgUnitLevel2" TEXT;
ALTER TABLE "employees" ADD COLUMN "region" TEXT;
ALTER TABLE "employees" ADD COLUMN "sourceRowData" JSONB;
ALTER TABLE "employees" ADD COLUMN "team" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "employees_organizationId_nationalId_key" ON "employees"("organizationId", "nationalId");

