-- Update RevenueScheduleStatus enum to reconciliation-focused values
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RevenueScheduleStatus_new') THEN
    DROP TYPE "RevenueScheduleStatus_new";
  END IF;
END$$;

CREATE TYPE "RevenueScheduleStatus_new" AS ENUM ('Unreconciled', 'Underpaid', 'Overpaid', 'Reconciled');

ALTER TABLE "RevenueSchedule" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "RevenueSchedule"
  ALTER COLUMN "status" TYPE "RevenueScheduleStatus_new"
  USING (
    CASE "status"
      WHEN 'Projected' THEN 'Unreconciled'
      WHEN 'Invoiced' THEN 'Underpaid'
      WHEN 'Paid' THEN 'Reconciled'
      WHEN 'Cancelled' THEN 'Underpaid'
      ELSE 'Unreconciled'
    END::"RevenueScheduleStatus_new"
  );

ALTER TABLE "RevenueSchedule" ALTER COLUMN "status" SET DEFAULT 'Unreconciled';

DROP TYPE "RevenueScheduleStatus";
ALTER TYPE "RevenueScheduleStatus_new" RENAME TO "RevenueScheduleStatus";
