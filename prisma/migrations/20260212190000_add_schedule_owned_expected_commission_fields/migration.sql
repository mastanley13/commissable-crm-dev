-- Add schedule-owned expected commission inputs.
ALTER TABLE "RevenueSchedule"
  ADD COLUMN IF NOT EXISTS "expectedCommissionRatePercent" DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS "expectedCommissionAdjustment" DECIMAL(16,2);

-- Backfill rate from the effective product rate at migration time.
UPDATE "RevenueSchedule" rs
SET "expectedCommissionRatePercent" = p."commissionPercent"
FROM "Product" p
WHERE rs."productId" = p."id"
  AND rs."expectedCommissionRatePercent" IS NULL
  AND p."commissionPercent" IS NOT NULL;

-- Preserve legacy "expected commission adjustment" values.
-- Today, UI/API flows have historically used actualCommissionAdjustment as the "expected" adjustment.
UPDATE "RevenueSchedule"
SET "expectedCommissionAdjustment" = "actualCommissionAdjustment"
WHERE "expectedCommissionAdjustment" IS NULL
  AND "actualCommissionAdjustment" IS NOT NULL;
