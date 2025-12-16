-- CreateEnum
CREATE TYPE "public"."CommissionPayoutSplitType" AS ENUM ('House', 'HouseRep', 'Subagent');

-- CreateEnum
CREATE TYPE "public"."CommissionPayoutStatus" AS ENUM ('Posted', 'Voided');

-- CreateTable
CREATE TABLE "public"."CommissionPayout" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "revenueScheduleId" UUID NOT NULL,
    "splitType" "public"."CommissionPayoutSplitType" NOT NULL,
    "status" "public"."CommissionPayoutStatus" NOT NULL DEFAULT 'Posted',
    "amount" DECIMAL(16,2) NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reference" TEXT,
    "notes" TEXT,
    "createdById" UUID,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommissionPayout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommissionPayout_tenantId_revenueScheduleId_idx" ON "public"."CommissionPayout"("tenantId", "revenueScheduleId");

-- CreateIndex
CREATE INDEX "CommissionPayout_tenantId_paidAt_idx" ON "public"."CommissionPayout"("tenantId", "paidAt");

-- AddForeignKey
ALTER TABLE "public"."CommissionPayout" ADD CONSTRAINT "CommissionPayout_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CommissionPayout" ADD CONSTRAINT "CommissionPayout_revenueScheduleId_fkey" FOREIGN KEY ("revenueScheduleId") REFERENCES "public"."RevenueSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CommissionPayout" ADD CONSTRAINT "CommissionPayout_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CommissionPayout" ADD CONSTRAINT "CommissionPayout_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

