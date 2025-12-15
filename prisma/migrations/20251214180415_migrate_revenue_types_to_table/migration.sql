-- CreateTable: revenue_types
CREATE TABLE "revenue_types" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 1000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "revenue_types_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "revenue_types_tenantId_code_key" ON "revenue_types"("tenantId", "code");
CREATE INDEX "revenue_types_tenantId_isActive_idx" ON "revenue_types"("tenantId", "isActive");
CREATE INDEX "revenue_types_tenantId_idx" ON "revenue_types"("tenantId");

-- AddForeignKey
ALTER TABLE "revenue_types" ADD CONSTRAINT "revenue_types_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed system revenue types for all existing tenants
INSERT INTO "revenue_types" ("tenantId", "code", "label", "description", "category", "isActive", "isSystem", "displayOrder", "updatedAt")
SELECT
    t.id,
    'NRC_PerItem',
    'NRC - Quantity',
    'Non-recurring amount multiplied by a quantity (e.g., $50 per phone sold in a single month).',
    'NRC',
    true,
    true,
    0,
    CURRENT_TIMESTAMP
FROM "Tenant" t;

INSERT INTO "revenue_types" ("tenantId", "code", "label", "description", "category", "isActive", "isSystem", "displayOrder", "updatedAt")
SELECT
    t.id,
    'NRC_Percent',
    'NRC - %',
    'Non-recurring bonus calculated as a percentage of another amount (e.g., 200% of monthly billing paid up front).',
    'NRC',
    true,
    true,
    100,
    CURRENT_TIMESTAMP
FROM "Tenant" t;

INSERT INTO "revenue_types" ("tenantId", "code", "label", "description", "category", "isActive", "isSystem", "displayOrder", "updatedAt")
SELECT
    t.id,
    'NRC_FlatFee',
    'NRC - Flat Fee',
    'Single non-recurring flat amount (e.g., a $100 gift card).',
    'NRC',
    true,
    true,
    200,
    CURRENT_TIMESTAMP
FROM "Tenant" t;

INSERT INTO "revenue_types" ("tenantId", "code", "label", "description", "category", "isActive", "isSystem", "displayOrder", "updatedAt")
SELECT
    t.id,
    'NRC_Resale',
    'NRC - Resale',
    'One-time resale transactions where the company buys and sells products/services (tracks gross profit).',
    'NRC',
    true,
    true,
    300,
    CURRENT_TIMESTAMP
FROM "Tenant" t;

INSERT INTO "revenue_types" ("tenantId", "code", "label", "description", "category", "isActive", "isSystem", "displayOrder", "updatedAt")
SELECT
    t.id,
    'MRC_ThirdParty',
    'MRC - 3rd Party',
    'Monthly recurring revenue billed by a third party (e.g., carrier services where we only receive commissions).',
    'MRC',
    true,
    true,
    400,
    CURRENT_TIMESTAMP
FROM "Tenant" t;

INSERT INTO "revenue_types" ("tenantId", "code", "label", "description", "category", "isActive", "isSystem", "displayOrder", "updatedAt")
SELECT
    t.id,
    'MRC_House',
    'MRC - House',
    'Monthly recurring revenue billed directly by the company (e.g., in-house consulting engagements).',
    'MRC',
    true,
    true,
    500,
    CURRENT_TIMESTAMP
FROM "Tenant" t;

-- Migrate Product.revenueType from enum to String
-- Step 1: Add temporary column
ALTER TABLE "Product" ADD COLUMN "revenueType_new" TEXT;

-- Step 2: Copy data from enum to string
UPDATE "Product" SET "revenueType_new" = "revenueType"::text;

-- Step 3: Drop the old enum column
ALTER TABLE "Product" DROP COLUMN "revenueType";

-- Step 4: Rename the new column
ALTER TABLE "Product" RENAME COLUMN "revenueType_new" TO "revenueType";

-- Step 5: Make the column NOT NULL
ALTER TABLE "Product" ALTER COLUMN "revenueType" SET NOT NULL;

-- Migrate OpportunityProduct.revenueTypeSnapshot from enum to String (nullable)
-- Step 1: Add temporary column
ALTER TABLE "OpportunityProduct" ADD COLUMN "revenueTypeSnapshot_new" TEXT;

-- Step 2: Copy data from enum to string (handles NULL)
UPDATE "OpportunityProduct" SET "revenueTypeSnapshot_new" = "revenueTypeSnapshot"::text
WHERE "revenueTypeSnapshot" IS NOT NULL;

-- Step 3: Drop the old enum column
ALTER TABLE "OpportunityProduct" DROP COLUMN "revenueTypeSnapshot";

-- Step 4: Rename the new column
ALTER TABLE "OpportunityProduct" RENAME COLUMN "revenueTypeSnapshot_new" TO "revenueTypeSnapshot";

-- Drop the RevenueType enum (no longer needed)
DROP TYPE "RevenueType";
