-- AlterTable
ALTER TABLE "DepositLineItem" ADD COLUMN     "hasSuggestedMatches" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastMatchCheckAt" TIMESTAMP(3),
ADD COLUMN     "reconciled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reconciledAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "DepositLineMatch" ADD COLUMN     "reconciled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reconciledAt" TIMESTAMP(3);

-- Backfill: Mark existing finalized deposits' line items as reconciled
UPDATE "DepositLineItem" dli
SET reconciled = true, "reconciledAt" = d."reconciledAt"
FROM "Deposit" d
WHERE dli."depositId" = d.id
  AND d.reconciled = true
  AND dli.status IN ('Matched', 'PartiallyMatched');

-- Backfill: Mark existing finalized deposits' matches as reconciled
UPDATE "DepositLineMatch" dlm
SET reconciled = true, "reconciledAt" = d."reconciledAt"
FROM "DepositLineItem" dli
JOIN "Deposit" d ON dli."depositId" = d.id
WHERE dlm."depositLineItemId" = dli.id
  AND d.reconciled = true
  AND dlm.status = 'Applied';

-- CreateIndex
CREATE INDEX "DepositLineItem_reconciled_idx" ON "DepositLineItem"("reconciled");

-- CreateIndex
CREATE INDEX "DepositLineItem_hasSuggestedMatches_idx" ON "DepositLineItem"("hasSuggestedMatches");

-- CreateIndex
CREATE INDEX "DepositLineMatch_reconciled_idx" ON "DepositLineMatch"("reconciled");
