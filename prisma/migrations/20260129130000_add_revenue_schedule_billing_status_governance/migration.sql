-- Add Billing Status governance fields to RevenueSchedule.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RevenueScheduleBillingStatusSource') THEN
    CREATE TYPE "RevenueScheduleBillingStatusSource" AS ENUM (
      'Auto',
      'Manual',
      'Settlement'
    );
  END IF;
END$$;

ALTER TABLE "RevenueSchedule"
  ADD COLUMN IF NOT EXISTS "billingStatusSource" "RevenueScheduleBillingStatusSource" NOT NULL DEFAULT 'Auto',
  ADD COLUMN IF NOT EXISTS "billingStatusUpdatedById" uuid,
  ADD COLUMN IF NOT EXISTS "billingStatusUpdatedAt" timestamptz,
  ADD COLUMN IF NOT EXISTS "billingStatusReason" text;

UPDATE "RevenueSchedule"
SET "billingStatusSource" = 'Auto'::"RevenueScheduleBillingStatusSource"
WHERE "billingStatusSource" IS NULL;

CREATE INDEX IF NOT EXISTS "RevenueSchedule_tenantId_billingStatusSource_idx"
  ON "RevenueSchedule"("tenantId", "billingStatusSource");

CREATE INDEX IF NOT EXISTS "RevenueSchedule_tenantId_billingStatusUpdatedById_idx"
  ON "RevenueSchedule"("tenantId", "billingStatusUpdatedById");

