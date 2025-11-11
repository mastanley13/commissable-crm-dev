-- Create reconciliation templates table to store reusable deposit mappings
CREATE TABLE "public"."ReconciliationTemplate" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "distributorAccountId" UUID NOT NULL,
  "vendorAccountId" UUID NOT NULL,
  "createdByUserId" UUID NOT NULL,
  "createdByContactId" UUID,
  "config" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReconciliationTemplate_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "public"."ReconciliationTemplate"
  ADD CONSTRAINT "ReconciliationTemplate_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."ReconciliationTemplate"
  ADD CONSTRAINT "ReconciliationTemplate_distributorAccountId_fkey"
  FOREIGN KEY ("distributorAccountId") REFERENCES "public"."Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."ReconciliationTemplate"
  ADD CONSTRAINT "ReconciliationTemplate_vendorAccountId_fkey"
  FOREIGN KEY ("vendorAccountId") REFERENCES "public"."Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."ReconciliationTemplate"
  ADD CONSTRAINT "ReconciliationTemplate_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."ReconciliationTemplate"
  ADD CONSTRAINT "ReconciliationTemplate_createdByContactId_fkey"
  FOREIGN KEY ("createdByContactId") REFERENCES "public"."Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "ReconciliationTemplate_tenant_distributor_vendor_unique"
  ON "public"."ReconciliationTemplate"("tenantId", "distributorAccountId", "vendorAccountId");

CREATE INDEX "ReconciliationTemplate_tenant_distributor_vendor_idx"
  ON "public"."ReconciliationTemplate"("tenantId", "distributorAccountId", "vendorAccountId");
