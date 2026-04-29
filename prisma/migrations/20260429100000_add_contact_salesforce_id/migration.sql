ALTER TABLE "Contact" ADD COLUMN "salesforceId" VARCHAR(18);

CREATE UNIQUE INDEX "Contact_tenantId_salesforceId_key" ON "Contact"("tenantId", "salesforceId");
