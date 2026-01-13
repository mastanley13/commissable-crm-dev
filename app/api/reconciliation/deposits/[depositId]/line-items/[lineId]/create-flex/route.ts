import { NextRequest, NextResponse } from "next/server"
import { withPermissions, createErrorResponse } from "@/lib/api-auth"
import { prisma } from "@/lib/db"
import { getTenantVarianceTolerance } from "@/lib/matching/settings"
import {
  createFlexChargebackForNegativeLine,
  createFlexProductForUnknownLine,
} from "@/lib/flex/revenue-schedule-flex-actions"

type FlexCreateKind = "FlexProduct" | "Chargeback"

interface CreateFlexRequestBody {
  kind?: FlexCreateKind
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

    const body = (await request.json().catch(() => null)) as CreateFlexRequestBody | null
    const requestedKind = body?.kind

    const line = await prisma.depositLineItem.findFirst({
      where: { tenantId, id: lineId, depositId },
      select: {
        id: true,
        reconciled: true,
        status: true,
        usage: true,
        commission: true,
      },
    })
    if (!line) {
      return createErrorResponse("Deposit line item not found", 404)
    }
    if (line.reconciled) {
      return createErrorResponse("Reconciled line items cannot be changed", 400)
    }

    const inferredKind: FlexCreateKind =
      Number(line.usage ?? 0) < 0 || Number(line.commission ?? 0) < 0 ? "Chargeback" : "FlexProduct"
    const kind = requestedKind ?? inferredKind

    const varianceTolerance = await getTenantVarianceTolerance(tenantId)

    try {
      const result = await prisma.$transaction(async tx => {
        return kind === "Chargeback"
          ? await createFlexChargebackForNegativeLine(tx, {
              tenantId,
              userId: req.user.id,
              depositId,
              lineItemId: lineId,
              varianceTolerance,
              request,
            })
          : await createFlexProductForUnknownLine(tx, {
              tenantId,
              userId: req.user.id,
              depositId,
              lineItemId: lineId,
              varianceTolerance,
              request,
            })
      })

      return NextResponse.json({ data: result })
    } catch (error) {
      console.error("Failed to create flex entry", error)
      return createErrorResponse(error instanceof Error ? error.message : "Failed to create flex entry", 400)
    }
  })
}

