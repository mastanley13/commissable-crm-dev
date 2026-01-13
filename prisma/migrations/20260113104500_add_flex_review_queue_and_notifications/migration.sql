-- Add FLEX review queue + in-app notifications.

DO $$
BEGIN
  CREATE TYPE "FlexReviewStatus" AS ENUM ('Open', 'Approved', 'Rejected', 'Resolved');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "FlexReviewItem" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "revenueScheduleId" UUID NOT NULL,
  "flexClassification" "RevenueScheduleFlexClassification" NOT NULL,
  "flexReasonCode" "RevenueScheduleFlexReasonCode",
  "sourceDepositId" UUID,
  "sourceDepositLineItemId" UUID,
  "status" "FlexReviewStatus" NOT NULL DEFAULT 'Open',
  "assignedToUserId" UUID,
  "createdById" UUID,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "FlexReviewItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "FlexReviewItem_tenantId_status_idx"
  ON "FlexReviewItem"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "FlexReviewItem_tenantId_revenueScheduleId_idx"
  ON "FlexReviewItem"("tenantId", "revenueScheduleId");
CREATE UNIQUE INDEX IF NOT EXISTS "FlexReviewItem_tenantId_revenueScheduleId_key"
  ON "FlexReviewItem"("tenantId", "revenueScheduleId");
CREATE INDEX IF NOT EXISTS "FlexReviewItem_tenantId_sourceDepositId_idx"
  ON "FlexReviewItem"("tenantId", "sourceDepositId");
CREATE INDEX IF NOT EXISTS "FlexReviewItem_tenantId_sourceDepositLineItemId_idx"
  ON "FlexReviewItem"("tenantId", "sourceDepositLineItemId");

DO $$
BEGIN
  ALTER TABLE "FlexReviewItem"
    ADD CONSTRAINT "FlexReviewItem_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "FlexReviewItem"
    ADD CONSTRAINT "FlexReviewItem_revenueScheduleId_fkey"
    FOREIGN KEY ("revenueScheduleId") REFERENCES "RevenueSchedule"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "FlexReviewItem"
    ADD CONSTRAINT "FlexReviewItem_assignedToUserId_fkey"
    FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "FlexReviewItem"
    ADD CONSTRAINT "FlexReviewItem_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "Notification" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT,
  "metadata" JSONB,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Notification_tenantId_userId_readAt_idx"
  ON "Notification"("tenantId", "userId", "readAt");
CREATE INDEX IF NOT EXISTS "Notification_tenantId_createdAt_idx"
  ON "Notification"("tenantId", "createdAt");

DO $$
BEGIN
  ALTER TABLE "Notification"
    ADD CONSTRAINT "Notification_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "Notification"
    ADD CONSTRAINT "Notification_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
