-- CreateEnum
CREATE TYPE "public"."DepositPaymentType" AS ENUM ('ACH', 'Wire', 'Check', 'CreditCard', 'Other');

-- DropForeignKey
ALTER TABLE "public"."ActivityAttachment" DROP CONSTRAINT "ActivityAttachment_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ActivityLink" DROP CONSTRAINT "ActivityLink_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ReconciliationTemplate" DROP CONSTRAINT "ReconciliationTemplate_tenantId_fkey";

-- AlterTable
ALTER TABLE "public"."Opportunity" ADD COLUMN     "accountIdDistributor" TEXT,
ADD COLUMN     "accountIdHouse" TEXT,
ADD COLUMN     "accountIdVendor" TEXT,
ADD COLUMN     "customerIdDistributor" TEXT,
ADD COLUMN     "customerIdHouse" TEXT,
ADD COLUMN     "customerIdVendor" TEXT,
ADD COLUMN     "customerPurchaseOrder" TEXT,
ADD COLUMN     "distributorName" TEXT,
ADD COLUMN     "locationId" TEXT,
ADD COLUMN     "orderIdDistributor" TEXT,
ADD COLUMN     "orderIdHouse" TEXT,
ADD COLUMN     "orderIdVendor" TEXT,
ADD COLUMN     "vendorName" TEXT;

-- AlterTable
ALTER TABLE "public"."ReconciliationTemplate" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "public"."OpportunityRole" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "opportunityId" UUID NOT NULL,
    "contactId" UUID,
    "role" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "jobTitle" TEXT,
    "email" TEXT,
    "workPhone" TEXT,
    "phoneExtension" TEXT,
    "mobile" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" UUID,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpportunityRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Deposit" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "month" TIMESTAMP(3) NOT NULL,
    "totalRevenue" DECIMAL(16,2),
    "totalCommissions" DECIMAL(16,2),
    "status" "public"."ReconciliationStatus" NOT NULL DEFAULT 'Pending',
    "reconciled" BOOLEAN NOT NULL DEFAULT false,
    "reconciledAt" TIMESTAMP(3),
    "depositName" TEXT,
    "paymentDate" TIMESTAMP(3),
    "paymentType" "public"."DepositPaymentType",
    "totalItems" INTEGER DEFAULT 0,
    "totalReconciledItems" INTEGER DEFAULT 0,
    "totalUsage" DECIMAL(16,2),
    "usageAllocated" DECIMAL(16,2),
    "usageUnallocated" DECIMAL(16,2),
    "commissionAllocated" DECIMAL(16,2),
    "commissionUnallocated" DECIMAL(16,2),
    "itemsReconciled" INTEGER DEFAULT 0,
    "itemsUnreconciled" INTEGER DEFAULT 0,
    "distributorAccountId" UUID,
    "vendorAccountId" UUID,
    "createdByUserId" UUID,
    "createdByContactId" UUID,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deposit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OpportunityRole_tenantId_opportunityId_idx" ON "public"."OpportunityRole"("tenantId", "opportunityId");

-- CreateIndex
CREATE INDEX "Deposit_tenantId_accountId_month_idx" ON "public"."Deposit"("tenantId", "accountId", "month");

-- CreateIndex
CREATE INDEX "Deposit_tenantId_paymentDate_idx" ON "public"."Deposit"("tenantId", "paymentDate");

-- CreateIndex
CREATE INDEX "Deposit_tenantId_distributorAccountId_vendorAccountId_idx" ON "public"."Deposit"("tenantId", "distributorAccountId", "vendorAccountId");

-- AddForeignKey
ALTER TABLE "public"."OpportunityRole" ADD CONSTRAINT "OpportunityRole_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "public"."Opportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OpportunityRole" ADD CONSTRAINT "OpportunityRole_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "public"."Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OpportunityRole" ADD CONSTRAINT "OpportunityRole_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OpportunityRole" ADD CONSTRAINT "OpportunityRole_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OpportunityRole" ADD CONSTRAINT "OpportunityRole_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Deposit" ADD CONSTRAINT "Deposit_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Deposit" ADD CONSTRAINT "Deposit_distributorAccountId_fkey" FOREIGN KEY ("distributorAccountId") REFERENCES "public"."Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Deposit" ADD CONSTRAINT "Deposit_vendorAccountId_fkey" FOREIGN KEY ("vendorAccountId") REFERENCES "public"."Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Deposit" ADD CONSTRAINT "Deposit_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Deposit" ADD CONSTRAINT "Deposit_createdByContactId_fkey" FOREIGN KEY ("createdByContactId") REFERENCES "public"."Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Deposit" ADD CONSTRAINT "Deposit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReconciliationTemplate" ADD CONSTRAINT "ReconciliationTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ActivityLink" ADD CONSTRAINT "ActivityLink_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ActivityAttachment" ADD CONSTRAINT "ActivityAttachment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "public"."ActivityLink_tenantId_entity_idx" RENAME TO "ActivityLink_tenantId_entityType_entityId_idx";

-- RenameIndex
ALTER INDEX "public"."ReconciliationTemplate_tenant_distributor_vendor_idx" RENAME TO "ReconciliationTemplate_tenantId_distributorAccountId_vendor_idx";

-- RenameIndex
ALTER INDEX "public"."ReconciliationTemplate_tenant_distributor_vendor_unique" RENAME TO "ReconciliationTemplate_tenantId_distributorAccountId_vendor_key";
