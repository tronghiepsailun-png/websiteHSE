-- AlterTable
ALTER TABLE "incidents" ADD COLUMN "costRmb" REAL;
ALTER TABLE "incidents" ADD COLUMN "costVnd" REAL;
ALTER TABLE "incidents" ADD COLUMN "injuredBodyPart" TEXT;
ALTER TABLE "incidents" ADD COLUMN "pointsDeducted" REAL;
ALTER TABLE "incidents" ADD COLUMN "responsiblePersonNameSnapshot" TEXT;
ALTER TABLE "incidents" ADD COLUMN "sourceRowData" JSONB;
