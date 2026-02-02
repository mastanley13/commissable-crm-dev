import { NextRequest, NextResponse } from "next/server"
import { withPermissions, createErrorResponse } from "@/lib/api-auth"
import { prisma } from "@/lib/db"
import { buildMatchGroupPreview, type MatchGroupAllocationInput } from "@/lib/matching/match-group-preview"
import type { MatchSelectionType } from "@/lib/matching/match-selection"

type PreviewRequestBody = {
  matchType: MatchSelectionType
  lineIds: string[]
  scheduleIds: string[]
  allocations?: MatchGroupAllocationInput[] | null
}

export async function POST(
  request: NextRequest,
  { params }: { params: { depositId: string } },
) {
  return withPermissions(request, ["reconciliation.manage"], async req => {
    const depositId = params?.depositId?.trim()
    const tenantId = req.user.tenantId

    if (!depositId) {
      return createErrorResponse("depositId is required", 400)
    }

    const body = (await request.json().catch(() => null)) as PreviewRequestBody | null
    if (!body) {
      return createErrorResponse("Request body is required", 400)
    }
    if (!body.matchType) {
      return createErrorResponse("matchType is required", 400)
    }
    if (!Array.isArray(body.lineIds) || body.lineIds.length === 0) {
      return createErrorResponse("lineIds is required", 400)
    }
    if (!Array.isArray(body.scheduleIds) || body.scheduleIds.length === 0) {
      return createErrorResponse("scheduleIds is required", 400)
    }

    const preview = await buildMatchGroupPreview(prisma, {
      tenantId,
      depositId,
      matchType: body.matchType,
      lineIds: body.lineIds,
      scheduleIds: body.scheduleIds,
      allocations: body.allocations,
    })

    return NextResponse.json({ data: preview })
  })
}

