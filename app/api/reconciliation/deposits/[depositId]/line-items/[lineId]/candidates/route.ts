import { NextRequest, NextResponse } from "next/server"
import { matchDepositLine } from "@/lib/matching/deposit-matcher"
import { withPermissions, createErrorResponse } from "@/lib/api-auth"
import { prisma } from "@/lib/db"

export async function GET(request: NextRequest, { params }: { params: { depositId: string; lineId: string } }) {
  return withPermissions(request, ["reconciliation.view"], async (req) => {
    const depositId = params?.depositId?.trim()
    const lineId = params?.lineId?.trim()
    const tenantId = req.user.tenantId

    if (!depositId || !lineId) {
      return createErrorResponse("Deposit id and line id are required", 400)
    }

    const lineItem = await prisma.depositLineItem.findFirst({
      where: { id: lineId, depositId, tenantId },
    })

    if (!lineItem) {
      return createErrorResponse("Deposit line item not found", 404)
    }

    const { candidates } = await matchDepositLine(lineId, { limit: 10 })

    const mapped = candidates.map(candidate => ({
      id: candidate.revenueScheduleId,
      status: "Suggested",
      lineItem: lineItem.lineNumber ?? 0,
      matchConfidence: candidate.matchConfidence,
      vendorName: candidate.vendorName ?? "",
      legalName: candidate.accountName ?? "",
      productNameVendor: candidate.productNameVendor ?? "",
      revenueScheduleDate: candidate.revenueScheduleDate,
      revenueScheduleName: candidate.revenueScheduleName,
      quantity: 1,
      priceEach: candidate.expectedUsage,
      expectedUsageGross: candidate.expectedUsage,
      expectedUsageAdjustment: 0,
      expectedUsageNet: candidate.expectedUsage,
      actualUsage: candidate.actualUsage,
      usageBalance: candidate.usageBalance,
      paymentDate: candidate.revenueScheduleDate,
      expectedCommissionGross: candidate.expectedCommission,
      expectedCommissionAdjustment: 0,
      expectedCommissionNet: candidate.expectedCommission,
      actualCommission: candidate.actualCommission,
      commissionDifference: candidate.commissionDifference,
      expectedCommissionRatePercent: candidate.expectedUsage !== 0 ? candidate.expectedCommission / candidate.expectedUsage : 0,
      actualCommissionRatePercent: candidate.actualUsage !== 0 ? candidate.actualCommission / candidate.actualUsage : 0,
      commissionRateDifference:
        candidate.expectedUsage !== 0 && candidate.actualUsage !== 0
          ? candidate.expectedCommission / candidate.expectedUsage - candidate.actualCommission / candidate.actualUsage
          : 0,
      signals: candidate.signals,
    }))

    return NextResponse.json({
      data: mapped,
    })
  })
}
