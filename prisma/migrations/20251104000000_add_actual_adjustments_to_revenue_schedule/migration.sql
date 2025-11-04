-- Add actual adjustment fields to RevenueSchedule
-- Matches prisma/schema.prisma optional Decimal(16,2) columns

-- AlterTable
ALTER TABLE "RevenueSchedule"
ADD COLUMN IF NOT EXISTS "actualUsageAdjustment" DECIMAL(16,2),
ADD COLUMN IF NOT EXISTS "actualCommissionAdjustment" DECIMAL(16,2);

