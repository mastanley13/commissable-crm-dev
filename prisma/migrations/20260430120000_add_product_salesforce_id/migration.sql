ALTER TABLE "Product" ADD COLUMN "salesforceId" VARCHAR(18);

CREATE UNIQUE INDEX "Product_tenantId_salesforceId_key" ON "Product"("tenantId", "salesforceId");
