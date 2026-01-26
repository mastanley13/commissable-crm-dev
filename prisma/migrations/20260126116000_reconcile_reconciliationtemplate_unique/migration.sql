-- Reconcile ReconciliationTemplate uniqueness + index naming.
--
-- Historical migrations leave an extra unique index on:
--   (tenantId, distributorAccountId, vendorAccountId)
-- renamed to: ReconciliationTemplate_tenantId_distributorAccountId_vendor_key
--
-- The live DB uses the canonical Prisma-style unique index name for:
--   (tenantId, distributorAccountId, vendorAccountId, name)
-- and does not keep a separate unique index for the 3-column prefix.

DO $$
BEGIN
  -- If the legacy 3-column unique index is still present under the "_vendor_key" name, drop it.
  IF EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'ReconciliationTemplate_tenantId_distributorAccountId_vendor_key'
      AND indexdef NOT ILIKE '%name%'
  ) THEN
    DROP INDEX "public"."ReconciliationTemplate_tenantId_distributorAccountId_vendor_key";
  END IF;
END$$;

DO $$
BEGIN
  -- Rename the 4-column unique index to the canonical Prisma-style name, if needed.
  IF to_regclass('public."ReconciliationTemplate_tenant_distributor_vendor_name_unique"') IS NOT NULL
     AND to_regclass('public."ReconciliationTemplate_tenantId_distributorAccountId_vendor_key"') IS NULL THEN
    ALTER INDEX "public"."ReconciliationTemplate_tenant_distributor_vendor_name_unique"
      RENAME TO "ReconciliationTemplate_tenantId_distributorAccountId_vendor_key";
  END IF;
END$$;

