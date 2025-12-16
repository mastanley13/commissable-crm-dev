-- Recreate historical migration to add a `comments` column on RevenueSchedule.
-- This is written defensively so it can run safely on databases where the
-- column already exists (e.g., development) without losing data.

ALTER TABLE "RevenueSchedule"
ADD COLUMN IF NOT EXISTS "comments" TEXT;

