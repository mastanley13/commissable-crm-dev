-- Add BundleOperation table for bundle rip-and-replace idempotency + undo anchoring.

CREATE TABLE IF NOT EXISTS "BundleOperation" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "depositId" UUID NOT NULL,
  "baseRevenueScheduleId" UUID NOT NULL,
  "baseOpportunityProductId" UUID NOT NULL,
  "baseScheduleDate" TIMESTAMP(3) NOT NULL,
  "mode" TEXT NOT NULL,
  "lineIds" JSONB NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "reason" TEXT,
  "createdProductIds" JSONB NOT NULL,
  "createdOpportunityProductIds" JSONB NOT NULL,
  "createdRevenueScheduleIds" JSONB NOT NULL,
  "replacedRevenueScheduleIds" JSONB NOT NULL,
  "lineToScheduleMap" JSONB NOT NULL,
  "applyAuditLogId" UUID,
  "undoneAt" TIMESTAMP(3),
  "undoneByUserId" UUID,
  "undoReason" TEXT,
  "undoAuditLogId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BundleOperation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BundleOperation_tenantId_depositId_idx"
  ON "BundleOperation"("tenantId", "depositId");

CREATE INDEX IF NOT EXISTS "BundleOperation_tenantId_idempotencyKey_idx"
  ON "BundleOperation"("tenantId", "idempotencyKey");

CREATE INDEX IF NOT EXISTS "BundleOperation_tenantId_applyAuditLogId_idx"
  ON "BundleOperation"("tenantId", "applyAuditLogId");

CREATE INDEX IF NOT EXISTS "BundleOperation_tenantId_createdAt_idx"
  ON "BundleOperation"("tenantId", "createdAt");

-- Only one active (not undone) operation per idempotency key.
CREATE UNIQUE INDEX IF NOT EXISTS "BundleOperation_tenantId_idempotencyKey_active_key"
  ON "BundleOperation"("tenantId", "idempotencyKey")
  WHERE "undoneAt" IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BundleOperation_tenantId_fkey'
  ) THEN
    ALTER TABLE "BundleOperation"
      ADD CONSTRAINT "BundleOperation_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BundleOperation_depositId_fkey'
  ) THEN
    ALTER TABLE "BundleOperation"
      ADD CONSTRAINT "BundleOperation_depositId_fkey"
      FOREIGN KEY ("depositId") REFERENCES "Deposit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BundleOperation_baseRevenueScheduleId_fkey'
  ) THEN
    ALTER TABLE "BundleOperation"
      ADD CONSTRAINT "BundleOperation_baseRevenueScheduleId_fkey"
      FOREIGN KEY ("baseRevenueScheduleId") REFERENCES "RevenueSchedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BundleOperation_baseOpportunityProductId_fkey'
  ) THEN
    ALTER TABLE "BundleOperation"
      ADD CONSTRAINT "BundleOperation_baseOpportunityProductId_fkey"
      FOREIGN KEY ("baseOpportunityProductId") REFERENCES "OpportunityProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BundleOperation_undoneByUserId_fkey'
  ) THEN
    ALTER TABLE "BundleOperation"
      ADD CONSTRAINT "BundleOperation_undoneByUserId_fkey"
      FOREIGN KEY ("undoneByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

