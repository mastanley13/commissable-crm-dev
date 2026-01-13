-- Add deposit part number + FLEX product reuse fields.

ALTER TABLE "DepositLineItem"
ADD COLUMN IF NOT EXISTS "partNumberRaw" TEXT;

ALTER TABLE "Product"
ADD COLUMN IF NOT EXISTS "isFlex" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "flexAccountId" UUID,
ADD COLUMN IF NOT EXISTS "flexType" TEXT;

CREATE INDEX IF NOT EXISTS "Product_tenantId_isFlex_flexAccountId_flexType_idx"
  ON "Product"("tenantId", "isFlex", "flexAccountId", "flexType");

