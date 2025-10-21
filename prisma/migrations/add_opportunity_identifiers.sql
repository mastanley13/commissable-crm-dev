-- Extend Opportunity table with identifier fields required for create modal
ALTER TABLE "Opportunity"
ADD COLUMN IF NOT EXISTS "orderIdVendor" TEXT,
ADD COLUMN IF NOT EXISTS "orderIdDistributor" TEXT,
ADD COLUMN IF NOT EXISTS "accountIdHouse" TEXT,
ADD COLUMN IF NOT EXISTS "accountIdVendor" TEXT,
ADD COLUMN IF NOT EXISTS "accountIdDistributor" TEXT,
ADD COLUMN IF NOT EXISTS "customerIdHouse" TEXT,
ADD COLUMN IF NOT EXISTS "customerIdVendor" TEXT,
ADD COLUMN IF NOT EXISTS "customerIdDistributor" TEXT,
ADD COLUMN IF NOT EXISTS "locationId" TEXT,
ADD COLUMN IF NOT EXISTS "customerPurchaseOrder" TEXT;

COMMENT ON COLUMN "Opportunity"."orderIdVendor" IS 'Order ID - Vendor (Field 01.07.002)';
COMMENT ON COLUMN "Opportunity"."orderIdDistributor" IS 'Order ID - Distributor (Field 01.07.003)';
COMMENT ON COLUMN "Opportunity"."accountIdHouse" IS 'Account ID - House (Field 01.07.010)';
COMMENT ON COLUMN "Opportunity"."accountIdVendor" IS 'Account ID - Vendor (Field 01.07.011)';
COMMENT ON COLUMN "Opportunity"."accountIdDistributor" IS 'Account ID - Distributor (Field 01.07.012)';
COMMENT ON COLUMN "Opportunity"."customerIdHouse" IS 'Customer ID - House (Field 01.07.013)';
COMMENT ON COLUMN "Opportunity"."customerIdVendor" IS 'Customer ID - Vendor (Field 01.07.014)';
COMMENT ON COLUMN "Opportunity"."customerIdDistributor" IS 'Customer ID - Distributor (Field 01.07.015)';
COMMENT ON COLUMN "Opportunity"."locationId" IS 'Location ID (Vendor) (Field 01.07.016)';
COMMENT ON COLUMN "Opportunity"."customerPurchaseOrder" IS 'Customer PO Number (Field 01.07.017)';
