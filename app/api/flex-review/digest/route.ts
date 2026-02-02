import { NextRequest, NextResponse } from "next/server"
import { withPermissions, createErrorResponse } from "@/lib/api-auth"
import { processFlexReviewDigestForTenant } from "@/jobs/flex-review-digest-runner"

export const dynamic = "force-dynamic"

function parseNumber(value: string | null, fallback: number): number {
  if (!value) return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export async function POST(request: NextRequest) {
  return withPermissions(request, ["reconciliation.manage"], async req => {
    const tenantId = req.user.tenantId
    const searchParams = request.nextUrl.searchParams
    const minAgeDays = Math.max(0, parseNumber(searchParams.get("minAgeDays"), 7))
    const dryRun = searchParams.get("dryRun") === "true"

    try {
      const result = await processFlexReviewDigestForTenant(tenantId, { minAgeDays, dryRun })
      return NextResponse.json({ data: result })
    } catch (error) {
      console.error("Failed to create flex review digest", error)
      return createErrorResponse(
        error instanceof Error ? error.message : "Failed to create flex review digest",
        500,
      )
    }
  })
}
