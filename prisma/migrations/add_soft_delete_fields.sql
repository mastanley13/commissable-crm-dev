-- Migration to add soft delete support
-- Add deletedAt fields to entities that don't have status enums

-- Contacts
ALTER TABLE "Contact" ADD COLUMN "deletedAt" TIMESTAMP;

-- Opportunities  
ALTER TABLE "Opportunity" ADD COLUMN "deletedAt" TIMESTAMP;

-- Activities
ALTER TABLE "Activity" ADD COLUMN "deletedAt" TIMESTAMP;

-- Tickets
ALTER TABLE "Ticket" ADD COLUMN "deletedAt" TIMESTAMP;

-- Groups
ALTER TABLE "Group" ADD COLUMN "deletedAt" TIMESTAMP;

-- Revenue Schedules
ALTER TABLE "RevenueSchedule" ADD COLUMN "deletedAt" TIMESTAMP;

-- Reconciliations
ALTER TABLE "Reconciliation" ADD COLUMN "deletedAt" TIMESTAMP;

-- Add indexes for performance on deletedAt fields
CREATE INDEX "Contact_tenantId_deletedAt_idx" ON "Contact"("tenantId", "deletedAt");
CREATE INDEX "Opportunity_tenantId_deletedAt_idx" ON "Opportunity"("tenantId", "deletedAt");
CREATE INDEX "Activity_tenantId_deletedAt_idx" ON "Activity"("tenantId", "deletedAt");
CREATE INDEX "Ticket_tenantId_deletedAt_idx" ON "Ticket"("tenantId", "deletedAt");
CREATE INDEX "Group_tenantId_deletedAt_idx" ON "Group"("tenantId", "deletedAt");
CREATE INDEX "RevenueSchedule_tenantId_deletedAt_idx" ON "RevenueSchedule"("tenantId", "deletedAt");
CREATE INDEX "Reconciliation_tenantId_deletedAt_idx" ON "Reconciliation"("tenantId", "deletedAt");