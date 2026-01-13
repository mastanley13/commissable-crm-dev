-- Add Chargeback Reversal FLEX classification + parent schedule linking.

-- Enum values (Postgres)
DO $$
BEGIN
  ALTER TYPE "RevenueScheduleFlexClassification" ADD VALUE IF NOT EXISTS 'FlexChargebackReversal';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE "RevenueScheduleFlexReasonCode" ADD VALUE IF NOT EXISTS 'ChargebackReversal';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Parent schedule backlink
ALTER TABLE "RevenueSchedule"
ADD COLUMN IF NOT EXISTS "parentRevenueScheduleId" UUID;

CREATE INDEX IF NOT EXISTS "RevenueSchedule_tenantId_parentRevenueScheduleId_idx"
  ON "RevenueSchedule"("tenantId", "parentRevenueScheduleId");

DO $$
BEGIN
  ALTER TABLE "RevenueSchedule"
    ADD CONSTRAINT "RevenueSchedule_parentRevenueScheduleId_fkey"
    FOREIGN KEY ("parentRevenueScheduleId") REFERENCES "RevenueSchedule"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

