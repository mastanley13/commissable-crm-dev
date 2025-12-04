import { NextRequest, NextResponse } from "next/server"
import { ReconciliationStatus } from "@prisma/client"
import { withPermissions, createErrorResponse } from "@/lib/api-auth"
import { prisma } from "@/lib/db"
import { getTenantMatchingPreferences } from "@/lib/matching/settings"
import { logMatchingMetric } from "@/lib/matching/metrics"

export async function POST(request: NextRequest, { params }: { params: { depositId: string } }) {
  return withPermissions(request, ["reconciliation.manage", "reconciliation.view"], async req => {
    const depositId = params?.depositId?.trim()
    const tenantId = req.user.tenantId

    if (!depositId) {
      return createErrorResponse("Deposit id is required", 400)
    }

    const deposit = await prisma.deposit.findFirst({
      where: { id: depositId, tenantId },
    })
    if (!deposit) {
      return createErrorResponse("Deposit not found", 404)
    }
    if (deposit.status === ReconciliationStatus.InReview) {
      return createErrorResponse("Deposit is already open for review", 400)
    }

    const prefs = await getTenantMatchingPreferences(tenantId)

    const updated = await prisma.$transaction(async (tx) => {
      // Unmark all lines
      await tx.depositLineItem.updateMany({
        where: { depositId, tenantId, reconciled: true },
        data: {
          reconciled: false,
          reconciledAt: null,
        },
      })

      // Unmark all matches
      await tx.depositLineMatch.updateMany({
        where: {
          tenantId,
          depositLineItem: { depositId },
          reconciled: true,
        },
        data: {
          reconciled: false,
          reconciledAt: null,
        },
      })

      // Unmark deposit
      return await tx.deposit.update({
        where: { id: depositId },
        data: {
          status: ReconciliationStatus.InReview,
          reconciled: false,
          reconciledAt: null,
        },
        select: {
          id: true,
          status: true,
          reconciled: true,
          reconciledAt: true,
        },
      })
    })

    await logMatchingMetric({
      tenantId,
      userId: req.user.id,
      event: "unfinalize",
      depositId,
      request,
      metadata: {
        varianceTolerance: prefs.varianceTolerance,
        includeFutureSchedulesDefault: prefs.includeFutureSchedulesDefault,
        engineMode: prefs.engineMode,
      },
    })

    return NextResponse.json({ data: updated })
  })
}
