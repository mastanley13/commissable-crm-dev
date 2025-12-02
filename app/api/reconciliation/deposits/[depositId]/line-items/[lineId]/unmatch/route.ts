import { NextRequest, NextResponse } from "next/server"
import { Prisma, DepositLineItemStatus } from "@prisma/client"
import { withPermissions, createErrorResponse } from "@/lib/api-auth"
import { prisma } from "@/lib/db"

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

    const lineItem = await prisma.depositLineItem.findFirst({
      where: { id: lineId, depositId, tenantId },
    })
    if (!lineItem) {
      return createErrorResponse("Deposit line item not found", 404)
    }

    const result = await prisma.$transaction(async tx => {
      await tx.depositLineMatch.deleteMany({
        where: { depositLineItemId: lineItem.id },
      })

      const updatedLine = await tx.depositLineItem.update({
        where: { id: lineItem.id },
        data: {
          status: DepositLineItemStatus.Unmatched,
          primaryRevenueScheduleId: null,
          usageAllocated: 0,
          usageUnallocated: lineItem.usage ?? 0,
          commissionAllocated: 0,
          commissionUnallocated: lineItem.commission ?? 0,
        },
      })

      const depositUpdate: Prisma.DepositUpdateInput = {
        itemsReconciled:
          lineItem.status === DepositLineItemStatus.Matched ? { decrement: 1 } : undefined,
        itemsUnreconciled:
          lineItem.status !== DepositLineItemStatus.Unmatched ? { increment: 1 } : undefined,
      }

      if (depositUpdate.itemsReconciled || depositUpdate.itemsUnreconciled) {
        await tx.deposit.update({
          where: { id: depositId },
          data: depositUpdate,
        })
      }

      return updatedLine
    })

    return NextResponse.json({ data: { lineItem: result } })
  })
}
