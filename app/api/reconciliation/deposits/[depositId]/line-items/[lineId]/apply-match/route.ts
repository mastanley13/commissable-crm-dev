import { NextRequest, NextResponse } from "next/server"
import {
  Prisma,
  DepositLineItemStatus,
  DepositLineMatchSource,
  DepositLineMatchStatus,
} from "@prisma/client"
import { withPermissions, createErrorResponse } from "@/lib/api-auth"
import { prisma } from "@/lib/db"

interface ApplyMatchRequestBody {
  revenueScheduleId: string
  usageAmount?: number
  commissionAmount?: number
  confidenceScore?: number
}

export async function POST(
  request: NextRequest,
  { params }: { params: { depositId: string; lineId: string } },
) {
  return withPermissions(request, ["reconciliation.view"], async req => {
    const depositId = params?.depositId?.trim()
    const lineId = params?.lineId?.trim()
    const tenantId = req.user.tenantId

    if (!depositId || !lineId) {
      return createErrorResponse("Deposit id and line id are required", 400)
    }

    const body = (await request.json().catch(() => null)) as ApplyMatchRequestBody | null
    if (!body || !body.revenueScheduleId) {
      return createErrorResponse("revenueScheduleId is required", 400)
    }

    const revenueScheduleId = body.revenueScheduleId.trim()
    const usageAmount = Number.isFinite(body.usageAmount) ? Number(body.usageAmount) : undefined
    const commissionAmount = Number.isFinite(body.commissionAmount)
      ? Number(body.commissionAmount)
      : undefined
    const confidenceScore =
      typeof body.confidenceScore === "number" ? body.confidenceScore : undefined

    const lineItem = await prisma.depositLineItem.findFirst({
      where: { id: lineId, depositId, tenantId },
      include: { deposit: true },
    })
    if (!lineItem) {
      return createErrorResponse("Deposit line item not found", 404)
    }

    const schedule = await prisma.revenueSchedule.findFirst({
      where: { id: revenueScheduleId, tenantId },
    })
    if (!schedule) {
      return createErrorResponse("Revenue schedule not found", 404)
    }

    const allocationUsage = usageAmount ?? Number(lineItem.usage ?? 0)
    const allocationCommission = commissionAmount ?? Number(lineItem.commission ?? 0)

    const result = await prisma.$transaction(async tx => {
      const match = await tx.depositLineMatch.upsert({
        where: {
          depositLineItemId_revenueScheduleId: {
            depositLineItemId: lineItem.id,
            revenueScheduleId,
          },
        },
        create: {
          tenantId,
          depositLineItemId: lineItem.id,
          revenueScheduleId,
          usageAmount: allocationUsage,
          commissionAmount: allocationCommission,
          confidenceScore,
          status: DepositLineMatchStatus.Applied,
          source: DepositLineMatchSource.Manual,
        },
        update: {
          usageAmount: allocationUsage,
          commissionAmount: allocationCommission,
          confidenceScore,
          status: DepositLineMatchStatus.Applied,
          source: DepositLineMatchSource.Manual,
        },
      })

      const updatedLine = await tx.depositLineItem.update({
        where: { id: lineItem.id },
        data: {
          status:
            allocationUsage >= Number(lineItem.usage ?? 0) &&
            allocationCommission >= Number(lineItem.commission ?? 0)
              ? DepositLineItemStatus.Matched
              : DepositLineItemStatus.PartiallyMatched,
          primaryRevenueScheduleId: revenueScheduleId,
          usageAllocated: allocationUsage,
          usageUnallocated: Math.max(Number(lineItem.usage ?? 0) - allocationUsage, 0),
          commissionAllocated: allocationCommission,
          commissionUnallocated: Math.max(Number(lineItem.commission ?? 0) - allocationCommission, 0),
        },
      })

      const depositUpdate: Prisma.DepositUpdateInput = {}
      const wasMatched = lineItem.status === DepositLineItemStatus.Matched
      const nowMatched = updatedLine.status === DepositLineItemStatus.Matched

      if (!wasMatched && nowMatched) {
        depositUpdate.itemsReconciled = { increment: 1 }
        depositUpdate.itemsUnreconciled = { decrement: 1 }
      } else if (wasMatched && !nowMatched) {
        depositUpdate.itemsReconciled = { decrement: 1 }
        depositUpdate.itemsUnreconciled = { increment: 1 }
      }

      if (Object.keys(depositUpdate).length > 0) {
        await tx.deposit.update({
          where: { id: depositId },
          data: depositUpdate,
        })
      }

      return { match, updatedLine }
    })

    return NextResponse.json({ data: result })
  })
}
