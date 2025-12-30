-- Add soft-delete support for RevenueSchedule.
ALTER TABLE "RevenueSchedule" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "RevenueSchedule_tenantId_deletedAt_idx"
  ON "RevenueSchedule"("tenantId", "deletedAt");
