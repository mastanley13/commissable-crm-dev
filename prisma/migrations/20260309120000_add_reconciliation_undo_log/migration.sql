CREATE TABLE "public"."ReconciliationUndoLog" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "depositId" UUID NOT NULL,
    "depositLineItemId" UUID NOT NULL,
    "entryType" TEXT NOT NULL,
    "targetEntityName" TEXT NOT NULL,
    "targetEntityId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdById" UUID,
    "reversedAt" TIMESTAMP(3),
    "reversedByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReconciliationUndoLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReconciliationUndoLog_tenantId_depositLineItemId_reversedAt_idx"
ON "public"."ReconciliationUndoLog"("tenantId", "depositLineItemId", "reversedAt");

CREATE INDEX "ReconciliationUndoLog_tenantId_depositId_createdAt_idx"
ON "public"."ReconciliationUndoLog"("tenantId", "depositId", "createdAt");

CREATE INDEX "ReconciliationUndoLog_tenantId_targetEntityName_targetEntityId_idx"
ON "public"."ReconciliationUndoLog"("tenantId", "targetEntityName", "targetEntityId");
