-- CreateEnum
CREATE TYPE "public"."DepositLineItemStatus" AS ENUM ('Unmatched', 'Suggested', 'Matched', 'PartiallyMatched', 'Ignored');

-- CreateEnum
CREATE TYPE "public"."DepositLineMatchStatus" AS ENUM ('Suggested', 'Applied', 'Rejected');

-- CreateEnum
CREATE TYPE "public"."DepositLineMatchSource" AS ENUM ('Auto', 'Manual');

-- CreateTable
CREATE TABLE "public"."DepositLineItem" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "depositId" UUID NOT NULL,
    "primaryRevenueScheduleId" UUID,
    "lineNumber" INTEGER,
    "status" "public"."DepositLineItemStatus" NOT NULL DEFAULT 'Unmatched',
    "paymentDate" TIMESTAMP(3),
    "accountId" UUID,
    "vendorAccountId" UUID,
    "productId" UUID,
    "accountIdVendor" TEXT,
    "customerIdVendor" TEXT,
    "orderIdVendor" TEXT,
    "accountNameRaw" TEXT,
    "vendorNameRaw" TEXT,
    "productNameRaw" TEXT,
    "distributorNameRaw" TEXT,
    "usage" DECIMAL(16,2),
    "usageAllocated" DECIMAL(16,2),
    "usageUnallocated" DECIMAL(16,2),
    "commission" DECIMAL(16,2),
    "commissionAllocated" DECIMAL(16,2),
    "commissionUnallocated" DECIMAL(16,2),
    "commissionRate" DECIMAL(7,4),
    "isChargeback" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DepositLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DepositLineMatch" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "depositLineItemId" UUID NOT NULL,
    "revenueScheduleId" UUID NOT NULL,
    "usageAmount" DECIMAL(16,2),
    "commissionAmount" DECIMAL(16,2),
    "confidenceScore" DOUBLE PRECISION,
    "status" "public"."DepositLineMatchStatus" NOT NULL DEFAULT 'Suggested',
    "source" "public"."DepositLineMatchSource" NOT NULL DEFAULT 'Auto',
    "explanation" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DepositLineMatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DepositLineItem_tenantId_depositId_idx" ON "public"."DepositLineItem"("tenantId", "depositId");

-- CreateIndex
CREATE INDEX "DepositLineItem_tenantId_accountIdVendor_idx" ON "public"."DepositLineItem"("tenantId", "accountIdVendor");

-- CreateIndex
CREATE INDEX "DepositLineItem_tenantId_customerIdVendor_idx" ON "public"."DepositLineItem"("tenantId", "customerIdVendor");

-- CreateIndex
CREATE INDEX "DepositLineItem_tenantId_orderIdVendor_idx" ON "public"."DepositLineItem"("tenantId", "orderIdVendor");

-- CreateIndex
CREATE INDEX "DepositLineMatch_tenantId_depositLineItemId_idx" ON "public"."DepositLineMatch"("tenantId", "depositLineItemId");

-- CreateIndex
CREATE INDEX "DepositLineMatch_tenantId_revenueScheduleId_idx" ON "public"."DepositLineMatch"("tenantId", "revenueScheduleId");

-- CreateIndex
CREATE UNIQUE INDEX "DepositLineMatch_depositLineItemId_revenueScheduleId_key" ON "public"."DepositLineMatch"("depositLineItemId", "revenueScheduleId");

-- AddForeignKey
ALTER TABLE "public"."DepositLineItem" ADD CONSTRAINT "DepositLineItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DepositLineItem" ADD CONSTRAINT "DepositLineItem_depositId_fkey" FOREIGN KEY ("depositId") REFERENCES "public"."Deposit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DepositLineItem" ADD CONSTRAINT "DepositLineItem_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DepositLineItem" ADD CONSTRAINT "DepositLineItem_vendorAccountId_fkey" FOREIGN KEY ("vendorAccountId") REFERENCES "public"."Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DepositLineItem" ADD CONSTRAINT "DepositLineItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DepositLineItem" ADD CONSTRAINT "DepositLineItem_primaryRevenueScheduleId_fkey" FOREIGN KEY ("primaryRevenueScheduleId") REFERENCES "public"."RevenueSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DepositLineMatch" ADD CONSTRAINT "DepositLineMatch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DepositLineMatch" ADD CONSTRAINT "DepositLineMatch_depositLineItemId_fkey" FOREIGN KEY ("depositLineItemId") REFERENCES "public"."DepositLineItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DepositLineMatch" ADD CONSTRAINT "DepositLineMatch_revenueScheduleId_fkey" FOREIGN KEY ("revenueScheduleId") REFERENCES "public"."RevenueSchedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
