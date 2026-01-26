-- Reconcile Prisma migration history with the current live database state (no data loss).
--
-- This database has drifted from the historical migrations in ways that are non-destructive:
-- - Index additions/removals and index renames (naming convention changes).
-- - Foreign key ON DELETE behavior changes (CASCADE -> RESTRICT).
-- - Removal of DB-level defaults on a few tables (Prisma already manages these at the app layer).
--
-- This migration makes a fresh DB (built by running the older migrations) end up matching the
-- live DB schema, while being a no-op (or minimal) on the live DB itself.

-- AuditLog: ensure composite index exists (it is present in the Prisma schema and in the live DB).
CREATE INDEX IF NOT EXISTS "AuditLog_tenantId_entityName_entityId_createdAt_idx"
  ON "public"."AuditLog"("tenantId", "entityName", "entityId", "createdAt");

-- Deposit: align index naming to Prisma's canonical name.
DO $$
BEGIN
  IF to_regclass('public."Deposit_tenant_reconciliationTemplateId_idx"') IS NOT NULL
     AND to_regclass('public."Deposit_tenantId_reconciliationTemplateId_idx"') IS NULL THEN
    ALTER INDEX "public"."Deposit_tenant_reconciliationTemplateId_idx"
      RENAME TO "Deposit_tenantId_reconciliationTemplateId_idx";
  END IF;
END$$;

-- ImportJob: align idempotency unique index naming.
DO $$
BEGIN
  IF to_regclass('public."ImportJob_tenant_entity_idempotencyKey_unique"') IS NOT NULL
     AND to_regclass('public."ImportJob_tenantId_entity_idempotencyKey_key"') IS NULL THEN
    ALTER INDEX "public"."ImportJob_tenant_entity_idempotencyKey_unique"
      RENAME TO "ImportJob_tenantId_entity_idempotencyKey_key";
  END IF;
END$$;

-- ReconciliationTemplate: align unique index naming for (tenantId, distributorAccountId, vendorAccountId, name).
DO $$
BEGIN
  IF to_regclass('public."ReconciliationTemplate_tenant_distributor_vendor_name_unique"') IS NOT NULL
     AND to_regclass('public."ReconciliationTemplate_tenantId_distributorAccountId_vendor_key"') IS NULL THEN
    ALTER INDEX "public"."ReconciliationTemplate_tenant_distributor_vendor_name_unique"
      RENAME TO "ReconciliationTemplate_tenantId_distributorAccountId_vendor_key";
  END IF;
END$$;

-- ReconciliationTemplate: ensure the legacy uniqueness on (tenantId, distributorAccountId, vendorAccountId) is not present.
DROP INDEX IF EXISTS "public"."ReconciliationTemplate_tenant_distributor_vendor_unique";

-- Remove indexes that exist in historical migrations but were intentionally dropped on the live DB.
DROP INDEX IF EXISTS "public"."Product_tenantId_isFlex_flexAccountId_flexType_idx";
DROP INDEX IF EXISTS "public"."RevenueSchedule_tenantId_flexClassification_idx";

-- FlexReviewItem: remove DB-level defaults (live DB has none).
ALTER TABLE "public"."FlexReviewItem"
  ALTER COLUMN "id" DROP DEFAULT;

ALTER TABLE "public"."FlexReviewItem"
  ALTER COLUMN "updatedAt" DROP DEFAULT;

-- FlexReviewItem: change ON DELETE from CASCADE to RESTRICT to match live DB and Prisma schema defaults.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'FlexReviewItem'
      AND c.conname = 'FlexReviewItem_tenantId_fkey'
      AND c.contype = 'f'
      AND c.confdeltype = 'c'
  ) THEN
    ALTER TABLE "public"."FlexReviewItem" DROP CONSTRAINT "FlexReviewItem_tenantId_fkey";
    ALTER TABLE "public"."FlexReviewItem"
      ADD CONSTRAINT "FlexReviewItem_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'FlexReviewItem'
      AND c.conname = 'FlexReviewItem_revenueScheduleId_fkey'
      AND c.contype = 'f'
      AND c.confdeltype = 'c'
  ) THEN
    ALTER TABLE "public"."FlexReviewItem" DROP CONSTRAINT "FlexReviewItem_revenueScheduleId_fkey";
    ALTER TABLE "public"."FlexReviewItem"
      ADD CONSTRAINT "FlexReviewItem_revenueScheduleId_fkey"
      FOREIGN KEY ("revenueScheduleId") REFERENCES "public"."RevenueSchedule"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END$$;

-- Notification: remove DB-level default for id (live DB has none).
ALTER TABLE "public"."Notification"
  ALTER COLUMN "id" DROP DEFAULT;

-- Notification: change ON DELETE from CASCADE to RESTRICT to match live DB and Prisma schema defaults.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'Notification'
      AND c.conname = 'Notification_tenantId_fkey'
      AND c.contype = 'f'
      AND c.confdeltype = 'c'
  ) THEN
    ALTER TABLE "public"."Notification" DROP CONSTRAINT "Notification_tenantId_fkey";
    ALTER TABLE "public"."Notification"
      ADD CONSTRAINT "Notification_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'Notification'
      AND c.conname = 'Notification_userId_fkey'
      AND c.contype = 'f'
      AND c.confdeltype = 'c'
  ) THEN
    ALTER TABLE "public"."Notification" DROP CONSTRAINT "Notification_userId_fkey";
    ALTER TABLE "public"."Notification"
      ADD CONSTRAINT "Notification_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "public"."User"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END$$;

