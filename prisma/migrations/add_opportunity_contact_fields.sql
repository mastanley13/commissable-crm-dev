-- Add new fields to Opportunity table for Account Details Opportunities Tab (Field IDs 01.07.000-01.07.007)
ALTER TABLE "Opportunity"
ADD COLUMN IF NOT EXISTS "orderIdHouse" TEXT,
ADD COLUMN IF NOT EXISTS "distributorName" TEXT,
ADD COLUMN IF NOT EXISTS "vendorName" TEXT,
ADD COLUMN IF NOT EXISTS "referredBy" TEXT,
ADD COLUMN IF NOT EXISTS "closeDate" TIMESTAMP(3);

-- Add comment for documentation
COMMENT ON COLUMN "Opportunity"."orderIdHouse" IS 'House - Order ID (Field 01.07.001)';
COMMENT ON COLUMN "Opportunity"."distributorName" IS 'Distributor Name (Field 01.07.004)';
COMMENT ON COLUMN "Opportunity"."vendorName" IS 'Vendor Name (Field 01.07.005)';
COMMENT ON COLUMN "Opportunity"."referredBy" IS 'Referred By (Field 01.07.006)';
COMMENT ON COLUMN "Opportunity"."closeDate" IS 'Close Date (Field 01.07.000)';
