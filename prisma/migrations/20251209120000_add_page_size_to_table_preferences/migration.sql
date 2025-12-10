-- Add persisted page size for table preferences
ALTER TABLE "TablePreference"
ADD COLUMN "pageSize" INTEGER;

-- Enforce a reasonable page size range (1–100) while allowing null for legacy rows
ALTER TABLE "TablePreference"
ADD CONSTRAINT "TablePreference_pageSize_check"
CHECK ("pageSize" IS NULL OR "pageSize" BETWEEN 1 AND 100);

