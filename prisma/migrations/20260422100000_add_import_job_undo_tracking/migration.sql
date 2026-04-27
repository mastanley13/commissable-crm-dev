CREATE TYPE "ImportJobUndoStatus" AS ENUM ('NotTracked', 'Undoable', 'Blocked', 'Undoing', 'Undone', 'UndoFailed');

CREATE TYPE "ImportJobRecordOperation" AS ENUM ('Created', 'Updated', 'Skipped');

CREATE TYPE "ImportJobUndoAction" AS ENUM ('None', 'DeleteCreatedRecord');

ALTER TABLE "ImportJob"
  ADD COLUMN "undoStatus" "ImportJobUndoStatus" NOT NULL DEFAULT 'NotTracked',
  ADD COLUMN "undoStartedAt" TIMESTAMP(3),
  ADD COLUMN "undoCompletedAt" TIMESTAMP(3),
  ADD COLUMN "undoneByUserId" UUID,
  ADD COLUMN "undoSummary" JSONB,
  ADD COLUMN "undoError" TEXT;

CREATE TABLE "ImportJobRecord" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "importJobId" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "rowNumber" INTEGER NOT NULL,
  "entityName" TEXT NOT NULL,
  "entityId" UUID NOT NULL,
  "operation" "ImportJobRecordOperation" NOT NULL,
  "undoAction" "ImportJobUndoAction" NOT NULL DEFAULT 'None',
  "undoOrder" INTEGER NOT NULL DEFAULT 0,
  "previousValues" JSONB,
  "newValues" JSONB,
  "undoneAt" TIMESTAMP(3),
  "undoError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ImportJobRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ImportJob_tenantId_undoStatus_idx" ON "ImportJob"("tenantId", "undoStatus");
CREATE INDEX "ImportJobRecord_importJobId_undoOrder_idx" ON "ImportJobRecord"("importJobId", "undoOrder");
CREATE INDEX "ImportJobRecord_tenantId_entityName_entityId_idx" ON "ImportJobRecord"("tenantId", "entityName", "entityId");
CREATE UNIQUE INDEX "ImportJobRecord_importJobId_entityName_entityId_operation_key" ON "ImportJobRecord"("importJobId", "entityName", "entityId", "operation");

ALTER TABLE "ImportJobRecord"
  ADD CONSTRAINT "ImportJobRecord_importJobId_fkey"
  FOREIGN KEY ("importJobId") REFERENCES "ImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ImportJobRecord"
  ADD CONSTRAINT "ImportJobRecord_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
