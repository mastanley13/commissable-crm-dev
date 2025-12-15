-- CreateIndex
CREATE INDEX "AuditLog_tenantId_entityName_entityId_createdAt_idx"
ON "public"."AuditLog"("tenantId", "entityName", "entityId", "createdAt");

