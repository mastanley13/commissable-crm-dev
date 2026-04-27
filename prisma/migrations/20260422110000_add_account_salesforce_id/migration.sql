ALTER TABLE "Account" ADD COLUMN "salesforceId" VARCHAR(18);

CREATE UNIQUE INDEX "Account_tenantId_salesforceId_key" ON "Account"("tenantId", "salesforceId");

