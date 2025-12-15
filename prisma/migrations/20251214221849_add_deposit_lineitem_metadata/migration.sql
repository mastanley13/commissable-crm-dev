-- DropIndex
DROP INDEX "AuditLog_tenantId_entityName_entityId_createdAt_idx";

-- DropIndex
DROP INDEX "ProductSubtype_tenantId_productFamilyId_idx";

-- AlterTable
ALTER TABLE "DepositLineItem" ADD COLUMN     "metadata" JSONB;
