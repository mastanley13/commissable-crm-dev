-- Add vendor ticket id field to Ticket (P0-DEP-002).

ALTER TABLE "Ticket"
ADD COLUMN IF NOT EXISTS "vendorTicketId" TEXT;

CREATE INDEX IF NOT EXISTS "Ticket_tenantId_vendorTicketId_idx"
  ON "Ticket"("tenantId", "vendorTicketId");

