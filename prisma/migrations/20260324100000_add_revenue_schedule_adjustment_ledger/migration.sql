-- Add first-class adjustment ledger rows plus match-group artifact ownership metadata.

ALTER TABLE "DepositMatchGroup"
ADD COLUMN "resolutionType" TEXT,
ADD COLUMN "createdRevenueScheduleIds" JSONB,
ADD COLUMN "createdOpportunityProductIds" JSONB,
ADD COLUMN "createdProductIds" JSONB,
ADD COLUMN "createdAdjustmentIds" JSONB,
ADD COLUMN "affectedRevenueScheduleIds" JSONB;

CREATE TABLE "RevenueScheduleAdjustment" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "revenueScheduleId" UUID NOT NULL,
  "matchGroupId" UUID,
  "sourceDepositId" UUID,
  "sourceDepositLineItemId" UUID,
  "adjustmentType" TEXT NOT NULL,
  "applicationScope" TEXT,
  "usageAmount" DECIMAL(16,2),
  "commissionAmount" DECIMAL(16,2),
  "effectiveScheduleDate" TIMESTAMP(3),
  "reason" TEXT,
  "createdById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reversedAt" TIMESTAMP(3),
  "reversedByUserId" UUID,

  CONSTRAINT "RevenueScheduleAdjustment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RevenueScheduleAdjustment_tenantId_revenueScheduleId_reversedAt_idx"
ON "RevenueScheduleAdjustment"("tenantId", "revenueScheduleId", "reversedAt");

CREATE INDEX "RevenueScheduleAdjustment_tenantId_matchGroupId_idx"
ON "RevenueScheduleAdjustment"("tenantId", "matchGroupId");

CREATE INDEX "RevenueScheduleAdjustment_tenantId_sourceDepositId_sourceDepositLineItemId_idx"
ON "RevenueScheduleAdjustment"("tenantId", "sourceDepositId", "sourceDepositLineItemId");

ALTER TABLE "RevenueScheduleAdjustment"
ADD CONSTRAINT "RevenueScheduleAdjustment_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RevenueScheduleAdjustment"
ADD CONSTRAINT "RevenueScheduleAdjustment_revenueScheduleId_fkey"
FOREIGN KEY ("revenueScheduleId") REFERENCES "RevenueSchedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RevenueScheduleAdjustment"
ADD CONSTRAINT "RevenueScheduleAdjustment_matchGroupId_fkey"
FOREIGN KEY ("matchGroupId") REFERENCES "DepositMatchGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RevenueScheduleAdjustment"
ADD CONSTRAINT "RevenueScheduleAdjustment_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RevenueScheduleAdjustment"
ADD CONSTRAINT "RevenueScheduleAdjustment_reversedByUserId_fkey"
FOREIGN KEY ("reversedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
