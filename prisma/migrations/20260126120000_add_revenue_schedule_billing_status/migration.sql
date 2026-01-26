-- Add Billing Status to RevenueSchedule (spec alignment).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RevenueScheduleBillingStatus') THEN
    CREATE TYPE "RevenueScheduleBillingStatus" AS ENUM (
      'Open',
      'Reconciled',
      'InDispute'
    );
  END IF;
END$$;

ALTER TABLE "RevenueSchedule"
ADD COLUMN IF NOT EXISTS "billingStatus" "RevenueScheduleBillingStatus" NOT NULL DEFAULT 'Open';

-- Backfill existing schedules to match current reconciliation outcomes.
-- Notes:
-- - Reconciled schedules become Reconciled.
-- - Overpaid schedules and Flex schedules become InDispute.
-- - Everything else defaults to Open.
UPDATE "RevenueSchedule"
SET "billingStatus" = (
  CASE
    WHEN "status" = 'Reconciled' THEN 'Reconciled'
    WHEN "status" = 'Overpaid' THEN 'InDispute'
    WHEN "flexClassification" IN ('FlexProduct', 'FlexChargeback', 'FlexChargebackReversal') THEN 'InDispute'
    ELSE 'Open'
  END
)::"RevenueScheduleBillingStatus"
WHERE "billingStatus" = 'Open'::"RevenueScheduleBillingStatus";

CREATE INDEX IF NOT EXISTS "RevenueSchedule_tenantId_billingStatus_idx"
  ON "RevenueSchedule"("tenantId", "billingStatus");
