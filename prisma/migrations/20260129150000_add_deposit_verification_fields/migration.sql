-- Add deposit verification fields to Deposit.

ALTER TABLE "Deposit"
  ADD COLUMN IF NOT EXISTS "actualReceivedAmount" DECIMAL(16,2),
  ADD COLUMN IF NOT EXISTS "receivedDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "receivedBy" TEXT;

