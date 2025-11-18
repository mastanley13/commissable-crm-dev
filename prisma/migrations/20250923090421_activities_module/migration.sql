-- Update ActivityType enum to new contract-aligned values
CREATE TYPE "public"."ActivityType_new" AS ENUM ('Call', 'Meeting', 'ToDo', 'Note', 'Other');
ALTER TABLE "public"."Activity"
  ALTER COLUMN "activityType" TYPE "public"."ActivityType_new"
  USING CASE
    WHEN "activityType"::text = 'Email' THEN 'Other'
    WHEN "activityType"::text = 'Task' THEN 'ToDo'
    ELSE "activityType"::text
  END::"public"."ActivityType_new";
DROP TYPE "public"."ActivityType";
ALTER TYPE "public"."ActivityType_new" RENAME TO "ActivityType";

CREATE TYPE "public"."ActivityStatus_new" AS ENUM ('Open', 'Completed');
ALTER TABLE "public"."Activity" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "public"."Activity"
  ALTER COLUMN "status" TYPE "public"."ActivityStatus_new"
  USING CASE
    WHEN "status"::text = 'Completed' THEN 'Completed'
    ELSE 'Open'
  END::"public"."ActivityStatus_new";
ALTER TABLE "public"."Activity" ALTER COLUMN "status" SET DEFAULT 'Open';
DROP TYPE "public"."ActivityStatus";
ALTER TYPE "public"."ActivityStatus_new" RENAME TO "ActivityStatus";

-- Extend Activity with updater + revenue schedule context
ALTER TABLE "public"."Activity" ADD COLUMN "revenueScheduleId" UUID;
ALTER TABLE "public"."Activity" ADD COLUMN "updatedById" UUID;
ALTER TABLE "public"."Activity" ADD CONSTRAINT "Activity_revenueScheduleId_fkey" FOREIGN KEY ("revenueScheduleId") REFERENCES "public"."RevenueSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."Activity" ADD CONSTRAINT "Activity_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Refresh Activity indexes for new query patterns
DROP INDEX IF EXISTS "public"."Activity_tenantId_assigneeId_status_idx";
DROP INDEX IF EXISTS "public"."Activity_tenantId_dueDate_idx";
CREATE INDEX IF NOT EXISTS "Activity_tenantId_accountId_idx" ON "public"."Activity"("tenantId", "accountId");
CREATE INDEX IF NOT EXISTS "Activity_tenantId_status_dueDate_idx" ON "public"."Activity"("tenantId", "status", "dueDate");
CREATE INDEX IF NOT EXISTS "Activity_tenantId_activityType_idx" ON "public"."Activity"("tenantId", "activityType");
CREATE INDEX IF NOT EXISTS "Activity_tenantId_assigneeId_idx" ON "public"."Activity"("tenantId", "assigneeId");
CREATE INDEX IF NOT EXISTS "Activity_tenantId_revenueScheduleId_idx" ON "public"."Activity"("tenantId", "revenueScheduleId");

-- Add audit-friendly soft delete support for contacts (aligning history with production)
ALTER TABLE "public"."Contact" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "public"."Contact" ADD COLUMN IF NOT EXISTS "deletedById" UUID;
CREATE INDEX IF NOT EXISTS "Contact_tenantId_deletedAt_idx" ON "public"."Contact"("tenantId", "deletedAt");
DO $$
BEGIN
  ALTER TABLE "public"."Contact" ADD CONSTRAINT "Contact_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create shared ActivityEntityType enum for cross-module linkage
CREATE TYPE "public"."ActivityEntityType" AS ENUM ('Account', 'Contact', 'Opportunity', 'RevenueSchedule', 'User', 'Other');

-- ActivityLink join table supports multi-entity visibility
CREATE TABLE "public"."ActivityLink" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "activityId" UUID NOT NULL,
  "entityType" "public"."ActivityEntityType" NOT NULL,
  "entityId" TEXT NOT NULL,
  "isPrimary" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ActivityLink_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "public"."ActivityLink" ADD CONSTRAINT "ActivityLink_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "public"."Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."ActivityLink" ADD CONSTRAINT "ActivityLink_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "ActivityLink_tenantId_entity_idx" ON "public"."ActivityLink"("tenantId", "entityType", "entityId");
CREATE INDEX "ActivityLink_tenantId_activityId_idx" ON "public"."ActivityLink"("tenantId", "activityId");

-- Centralised attachment metadata table for Activities
CREATE TABLE "public"."ActivityAttachment" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "activityId" UUID NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "storageKey" TEXT NOT NULL,
  "checksum" TEXT,
  "uploadedById" UUID NOT NULL,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ActivityAttachment_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "public"."ActivityAttachment" ADD CONSTRAINT "ActivityAttachment_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "public"."Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."ActivityAttachment" ADD CONSTRAINT "ActivityAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."ActivityAttachment" ADD CONSTRAINT "ActivityAttachment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "ActivityAttachment_tenantId_activityId_idx" ON "public"."ActivityAttachment"("tenantId", "activityId");

