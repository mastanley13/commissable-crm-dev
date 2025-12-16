-- Add override split percentage fields to RevenueSchedule
-- to support Revenue Schedule Detail v2.

ALTER TABLE "RevenueSchedule"
ADD COLUMN IF NOT EXISTS "houseSplitPercentOverride" NUMERIC(5,4),
ADD COLUMN IF NOT EXISTS "houseRepSplitPercentOverride" NUMERIC(5,4),
ADD COLUMN IF NOT EXISTS "subagentSplitPercentOverride" NUMERIC(5,4);

