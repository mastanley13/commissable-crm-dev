-- Add soft-merge metadata for Accounts + Contacts and support audit log Merge action.

ALTER TYPE "public"."AuditAction" ADD VALUE IF NOT EXISTS 'Merge';

ALTER TABLE "Account"
ADD COLUMN "mergedIntoAccountId" UUID,
ADD COLUMN "mergedAt" TIMESTAMP(3),
ADD COLUMN "mergedById" UUID;

ALTER TABLE "Contact"
ADD COLUMN "mergedIntoContactId" UUID,
ADD COLUMN "mergedAt" TIMESTAMP(3),
ADD COLUMN "mergedById" UUID;

ALTER TABLE "Account"
ADD CONSTRAINT "Account_mergedIntoAccountId_fkey"
FOREIGN KEY ("mergedIntoAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Account"
ADD CONSTRAINT "Account_mergedById_fkey"
FOREIGN KEY ("mergedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Contact"
ADD CONSTRAINT "Contact_mergedIntoContactId_fkey"
FOREIGN KEY ("mergedIntoContactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Contact"
ADD CONSTRAINT "Contact_mergedById_fkey"
FOREIGN KEY ("mergedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "Account_tenantId_mergedIntoAccountId_idx"
ON "Account"("tenantId", "mergedIntoAccountId");

CREATE INDEX IF NOT EXISTS "Account_tenantId_mergedAt_idx"
ON "Account"("tenantId", "mergedAt");

CREATE INDEX IF NOT EXISTS "Contact_tenantId_mergedIntoContactId_idx"
ON "Contact"("tenantId", "mergedIntoContactId");

CREATE INDEX IF NOT EXISTS "Contact_tenantId_mergedAt_idx"
ON "Contact"("tenantId", "mergedAt");

