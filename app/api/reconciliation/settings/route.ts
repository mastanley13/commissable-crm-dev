import { NextRequest, NextResponse } from "next/server"
import { withPermissions, createErrorResponse } from "@/lib/api-auth"
import {
  getTenantMatchingPreferences,
  saveTenantMatchingPreferences,
  type MatchingEngineMode,
} from "@/lib/matching/settings"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  return withPermissions(request, ["reconciliation.view"], async req => {
    const tenantId = req.user.tenantId
    const prefs = await getTenantMatchingPreferences(tenantId)
    return NextResponse.json({ data: prefs })
  })
}

interface UpdateSettingsBody {
  varianceTolerance?: number
  includeFutureSchedulesDefault?: boolean
  engineMode?: MatchingEngineMode
}

export async function POST(request: NextRequest) {
  return withPermissions(request, ["reconciliation.manage"], async req => {
    const tenantId = req.user.tenantId
    const body = (await request.json().catch(() => null)) as UpdateSettingsBody | null

    if (!body) {
      return createErrorResponse("Request body is required", 400)
    }

    const updates: UpdateSettingsBody = {}

    if (body.varianceTolerance != null) {
      const normalized = Number(body.varianceTolerance)
      if (!Number.isFinite(normalized) || normalized < 0 || normalized > 1) {
        return createErrorResponse("varianceTolerance must be between 0 and 1", 400)
      }
      updates.varianceTolerance = normalized
    }

    if (typeof body.includeFutureSchedulesDefault === "boolean") {
      updates.includeFutureSchedulesDefault = body.includeFutureSchedulesDefault
    }

    if (body.engineMode) {
      const engineMode = body.engineMode
      if (!["legacy", "hierarchical", "env"].includes(engineMode)) {
        return createErrorResponse("engineMode must be legacy, hierarchical, or env", 400)
      }
      updates.engineMode = engineMode as MatchingEngineMode
    }

    if (
      updates.varianceTolerance == null &&
      updates.includeFutureSchedulesDefault == null &&
      updates.engineMode == null
    ) {
      return createErrorResponse("No valid settings provided", 400)
    }

    await saveTenantMatchingPreferences(tenantId, updates)
    const prefs = await getTenantMatchingPreferences(tenantId)

    return NextResponse.json({ data: prefs })
  })
}
