import { NextRequest, NextResponse } from "next/server"
import { candidatesToSuggestedRows, matchDepositLine } from "@/lib/matching/deposit-matcher"
import { withPermissions, createErrorResponse } from "@/lib/api-auth"
import { prisma } from "@/lib/db"

export async function GET(request: NextRequest, { params }: { params: { depositId: string; lineId: string } }) {
  return withPermissions(request, ["reconciliation.view"], async (req) => {
    const depositId = params?.depositId?.trim()
    const lineId = params?.lineId?.trim()
    const tenantId = req.user.tenantId
    const searchParams = request.nextUrl.searchParams
    const includeFutureSchedules = searchParams.get("includeFutureSchedules") === "true"
    const useHierarchicalMatchingParam = searchParams.get("useHierarchicalMatching")
    const useHierarchicalMatching =
      useHierarchicalMatchingParam === null ? undefined : useHierarchicalMatchingParam === "true"

    if (!depositId || !lineId) {
      return createErrorResponse("Deposit id and line id are required", 400)
    }

    const lineItem = await prisma.depositLineItem.findFirst({
      where: { id: lineId, depositId, tenantId },
    })

    if (!lineItem) {
      return createErrorResponse("Deposit line item not found", 404)
    }

    const matchResult = await matchDepositLine(lineId, {
      limit: 10,
      includeFutureSchedules,
      useHierarchicalMatching,
    })
    const mapped = candidatesToSuggestedRows(
      matchResult.lineItem,
      matchResult.candidates,
      matchResult.appliedMatchScheduleId,
    )

    return NextResponse.json({
      data: mapped,
    })
  })
}
