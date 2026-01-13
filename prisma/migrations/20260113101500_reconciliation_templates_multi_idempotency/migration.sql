-- Allow multiple reconciliation templates per distributor/vendor by name,
-- add import idempotency key support, and store the template used on deposits.

-- ReconciliationTemplate: change unique constraint from (tenant, distributor, vendor) to (tenant, distributor, vendor, name)
DROP INDEX IF EXISTS "public"."ReconciliationTemplate_tenant_distributor_vendor_unique";
CREATE UNIQUE INDEX "ReconciliationTemplate_tenant_distributor_vendor_name_unique"
  ON "public"."ReconciliationTemplate"("tenantId", "distributorAccountId", "vendorAccountId", "name");

-- ImportJob: idempotency key for safe retries
ALTER TABLE "public"."ImportJob"
  ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "ImportJob_tenant_entity_idempotencyKey_unique"
  ON "public"."ImportJob"("tenantId", "entity", "idempotencyKey");

-- Deposit: store which reconciliation template was used for the upload
ALTER TABLE "public"."Deposit"
  ADD COLUMN IF NOT EXISTS "reconciliationTemplateId" UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Deposit_reconciliationTemplateId_fkey'
  ) THEN
    ALTER TABLE "public"."Deposit"
      ADD CONSTRAINT "Deposit_reconciliationTemplateId_fkey"
      FOREIGN KEY ("reconciliationTemplateId") REFERENCES "public"."ReconciliationTemplate"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS "Deposit_tenant_reconciliationTemplateId_idx"
  ON "public"."Deposit"("tenantId", "reconciliationTemplateId");
