-- Add FLEX classification fields to RevenueSchedule.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RevenueScheduleFlexClassification') THEN
    CREATE TYPE "RevenueScheduleFlexClassification" AS ENUM (
      'Normal',
      'Adjustment',
      'FlexProduct',
      'FlexChargeback',
      'Bonus'
    );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RevenueScheduleFlexReasonCode') THEN
    CREATE TYPE "RevenueScheduleFlexReasonCode" AS ENUM (
      'OverageWithinTolerance',
      'OverageOutsideTolerance',
      'UnknownProduct',
      'ChargebackNegative',
      'BonusVariance',
      'Manual'
    );
  END IF;
END$$;

ALTER TABLE "RevenueSchedule"
ADD COLUMN IF NOT EXISTS "flexClassification" "RevenueScheduleFlexClassification" NOT NULL DEFAULT 'Normal',
ADD COLUMN IF NOT EXISTS "flexReasonCode" "RevenueScheduleFlexReasonCode",
ADD COLUMN IF NOT EXISTS "flexSourceDepositId" UUID,
ADD COLUMN IF NOT EXISTS "flexSourceDepositLineItemId" UUID;

CREATE INDEX IF NOT EXISTS "RevenueSchedule_tenantId_flexClassification_idx"
  ON "RevenueSchedule"("tenantId", "flexClassification");
