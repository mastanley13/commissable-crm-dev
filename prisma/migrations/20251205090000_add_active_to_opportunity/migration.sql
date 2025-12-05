-- Add an `active` flag to Opportunity for UI-level active/inactive toggles
DO $$
BEGIN
  ALTER TABLE "public"."Opportunity"
    ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT TRUE;
EXCEPTION
  WHEN duplicate_column THEN
    NULL;
END $$;

-- Backfill: treat clearly closed-out opportunities as inactive by default
UPDATE "public"."Opportunity"
SET "active" = FALSE
WHERE "status" = 'Lost'
   OR "stage" IN ('ClosedLost', 'ClosedWon_BillingEnded');

-- Helpful index for tenant + active filtering on list views
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "Opportunity_tenantId_active_idx"
    ON "public"."Opportunity"("tenantId", "active");
EXCEPTION
  WHEN duplicate_table THEN
    NULL;
END $$;

