-- Add columns to support inline editing on Opportunity detail view
ALTER TABLE "Opportunity"
  ADD COLUMN "referredBy" TEXT,
  ADD COLUMN "shippingAddress" TEXT,
  ADD COLUMN "billingAddress" TEXT,
  ADD COLUMN "subagentPercent" NUMERIC(5,4),
  ADD COLUMN "houseRepPercent" NUMERIC(5,4),
  ADD COLUMN "houseSplitPercent" NUMERIC(5,4);

