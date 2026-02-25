import { NextRequest, NextResponse } from "next/server"
import { createErrorResponse, withPermissions } from "@/lib/api-auth"
import { previewAccountMerge } from "@/lib/merge/account-merge"
import { previewContactMerge } from "@/lib/merge/contact-merge"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MERGE_PERMISSIONS = ["admin.data_settings.merge"]

type PreviewBody = {
  entity: "Account" | "Contact"
  targetId: string
  sourceId: string
}

export async function POST(request: NextRequest) {
  return withPermissions(request, MERGE_PERMISSIONS, async req => {
    try {
      const body = (await request.json()) as Partial<PreviewBody>
      const entity = body.entity
      const targetId = typeof body.targetId === "string" ? body.targetId.trim() : ""
      const sourceId = typeof body.sourceId === "string" ? body.sourceId.trim() : ""

      if (entity !== "Account" && entity !== "Contact") {
        return createErrorResponse("Invalid entity type.", 400)
      }
      if (!targetId || !sourceId) {
        return createErrorResponse("targetId and sourceId are required.", 400)
      }

      const tenantId = req.user.tenantId

      const preview =
        entity === "Account"
          ? await previewAccountMerge({ tenantId, targetId, sourceId })
          : await previewContactMerge({ tenantId, targetId, sourceId })

      return NextResponse.json({ data: preview })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to preview merge."
      return createErrorResponse(message, 400)
    }
  })
}

