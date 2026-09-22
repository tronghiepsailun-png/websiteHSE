-- AlterTable
ALTER TABLE "users" ADD COLUMN "lastLoginAt" DATETIME;

-- CreateIndex
CREATE INDEX "audit_logs_organizationId_createdAt_idx" ON "audit_logs"("organizationId", "createdAt");
