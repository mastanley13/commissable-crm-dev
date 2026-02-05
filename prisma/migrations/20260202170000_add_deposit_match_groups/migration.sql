-- Add deposit match group support (DepositMatchGroup + DepositLineMatch.matchGroupId).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DepositMatchType') THEN
    CREATE TYPE "DepositMatchType" AS ENUM (
      'OneToOne',
      'OneToMany',
      'ManyToOne',
      'ManyToMany'
    );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DepositMatchGroupStatus') THEN
    CREATE TYPE "DepositMatchGroupStatus" AS ENUM (
      'Applied',
      'Undone'
    );
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS "DepositMatchGroup" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "depositId" UUID NOT NULL,
  "matchType" "DepositMatchType" NOT NULL,
  "status" "DepositMatchGroupStatus" NOT NULL DEFAULT 'Applied',
  "createdByUserId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "undoneAt" TIMESTAMP(3),
  "undoneByUserId" UUID,
  "undoReason" TEXT,

  CONSTRAINT "DepositMatchGroup_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "DepositLineMatch"
  ADD COLUMN IF NOT EXISTS "matchGroupId" UUID;

CREATE INDEX IF NOT EXISTS "DepositLineMatch_tenantId_matchGroupId_idx"
  ON "DepositLineMatch"("tenantId", "matchGroupId");

CREATE INDEX IF NOT EXISTS "DepositMatchGroup_tenantId_depositId_idx"
  ON "DepositMatchGroup"("tenantId", "depositId");

CREATE INDEX IF NOT EXISTS "DepositMatchGroup_tenantId_createdAt_idx"
  ON "DepositMatchGroup"("tenantId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'DepositMatchGroup_tenantId_fkey'
  ) THEN
    ALTER TABLE "DepositMatchGroup"
      ADD CONSTRAINT "DepositMatchGroup_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'DepositMatchGroup_depositId_fkey'
  ) THEN
    ALTER TABLE "DepositMatchGroup"
      ADD CONSTRAINT "DepositMatchGroup_depositId_fkey"
      FOREIGN KEY ("depositId") REFERENCES "Deposit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'DepositMatchGroup_createdByUserId_fkey'
  ) THEN
    ALTER TABLE "DepositMatchGroup"
      ADD CONSTRAINT "DepositMatchGroup_createdByUserId_fkey"
      FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'DepositMatchGroup_undoneByUserId_fkey'
  ) THEN
    ALTER TABLE "DepositMatchGroup"
      ADD CONSTRAINT "DepositMatchGroup_undoneByUserId_fkey"
      FOREIGN KEY ("undoneByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'DepositLineMatch_matchGroupId_fkey'
  ) THEN
    ALTER TABLE "DepositLineMatch"
      ADD CONSTRAINT "DepositLineMatch_matchGroupId_fkey"
      FOREIGN KEY ("matchGroupId") REFERENCES "DepositMatchGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;
