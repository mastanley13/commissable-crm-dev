ALTER TYPE "public"."DataEntity" ADD VALUE IF NOT EXISTS 'DepositTransactions';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'HistoricalDepositBucket'
  ) THEN
    CREATE TYPE "public"."HistoricalDepositBucket" AS ENUM ('None', 'SettledHistory', 'OpenOrDisputed');
  END IF;
END $$;

ALTER TABLE "public"."Deposit"
  ADD COLUMN IF NOT EXISTS "historicalBucket" "public"."HistoricalDepositBucket" NOT NULL DEFAULT 'None',
  ADD COLUMN IF NOT EXISTS "sourceSystem" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceDepositKey" TEXT,
  ADD COLUMN IF NOT EXISTS "importedViaAdmin" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "public"."DepositLineItem"
  ADD COLUMN IF NOT EXISTS "sourceSystem" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceTransactionKey" TEXT;

CREATE INDEX IF NOT EXISTS "Deposit_tenantId_historicalBucket_idx"
  ON "public"."Deposit"("tenantId", "historicalBucket");

CREATE UNIQUE INDEX IF NOT EXISTS "Deposit_tenantId_sourceSystem_sourceDepositKey_key"
  ON "public"."Deposit"("tenantId", "sourceSystem", "sourceDepositKey");

CREATE INDEX IF NOT EXISTS "DepositLineItem_tenantId_sourceTransactionKey_idx"
  ON "public"."DepositLineItem"("tenantId", "sourceTransactionKey");

CREATE UNIQUE INDEX IF NOT EXISTS "DepositLineItem_tenantId_sourceSystem_sourceTransactionKey_key"
  ON "public"."DepositLineItem"("tenantId", "sourceSystem", "sourceTransactionKey");
