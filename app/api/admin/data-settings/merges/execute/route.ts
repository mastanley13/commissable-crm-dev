import { NextRequest, NextResponse } from "next/server"
import { createErrorResponse, withPermissions } from "@/lib/api-auth"
import { executeAccountMerge } from "@/lib/merge/account-merge"
import { executeContactMerge } from "@/lib/merge/contact-merge"
import type { MergeWinner } from "@/lib/merge/merge-types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MERGE_PERMISSIONS = ["admin.data_settings.merge"]

type ExecuteBody = {
  entity: "Account" | "Contact"
  targetId: string
  sourceId: string
  fieldWinners?: Record<string, MergeWinner | undefined>
  dryRun?: boolean
}

export async function POST(request: NextRequest) {
  return withPermissions(request, MERGE_PERMISSIONS, async req => {
    try {
      const body = (await request.json()) as Partial<ExecuteBody>
      const entity = body.entity
      const targetId = typeof body.targetId === "string" ? body.targetId.trim() : ""
      const sourceId = typeof body.sourceId === "string" ? body.sourceId.trim() : ""
      const dryRun = body.dryRun === true
      const fieldWinners = body.fieldWinners && typeof body.fieldWinners === "object" ? body.fieldWinners : {}

      if (entity !== "Account" && entity !== "Contact") {
        return createErrorResponse("Invalid entity type.", 400)
      }
      if (!targetId || !sourceId) {
        return createErrorResponse("targetId and sourceId are required.", 400)
      }

      const tenantId = req.user.tenantId
      const userId = req.user.id

      const result =
        entity === "Account"
          ? await executeAccountMerge({ tenantId, userId, targetId, sourceId, fieldWinners, dryRun })
          : await executeContactMerge({ tenantId, userId, targetId, sourceId, fieldWinners, dryRun })

      return NextResponse.json({ data: result })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to execute merge."
      return createErrorResponse(message, 400)
    }
  })
}

