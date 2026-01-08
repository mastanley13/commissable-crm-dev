import { NextRequest, NextResponse } from "next/server"
import { withAuth, createErrorResponse } from "@/lib/api-auth"
import {
  getUserReconciliationConfidencePreferences,
  saveUserReconciliationConfidencePreferences,
} from "@/lib/matching/user-confidence-settings"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  return withAuth(request, async req => {
    const tenantId = req.user.tenantId
    const userId = req.user.id
    const prefs = await getUserReconciliationConfidencePreferences(tenantId, userId)
    return NextResponse.json({ data: prefs })
  })
}

interface UpdateUserReconciliationSettingsBody {
  suggestedMatchesMinConfidence?: number
  autoMatchMinConfidence?: number
}

export async function POST(request: NextRequest) {
  return withAuth(request, async req => {
    const tenantId = req.user.tenantId
    const userId = req.user.id
    const body = (await request.json().catch(() => null)) as UpdateUserReconciliationSettingsBody | null

    if (!body) {
      return createErrorResponse("Request body is required", 400)
    }

    const updates: UpdateUserReconciliationSettingsBody = {}

    if (body.suggestedMatchesMinConfidence != null) {
      const normalized = Number(body.suggestedMatchesMinConfidence)
      if (!Number.isFinite(normalized) || normalized < 0 || normalized > 1) {
        return createErrorResponse("suggestedMatchesMinConfidence must be between 0 and 1", 400)
      }
      updates.suggestedMatchesMinConfidence = normalized
    }

    if (body.autoMatchMinConfidence != null) {
      const normalized = Number(body.autoMatchMinConfidence)
      if (!Number.isFinite(normalized) || normalized < 0 || normalized > 1) {
        return createErrorResponse("autoMatchMinConfidence must be between 0 and 1", 400)
      }
      updates.autoMatchMinConfidence = normalized
    }

    if (updates.suggestedMatchesMinConfidence == null && updates.autoMatchMinConfidence == null) {
      return createErrorResponse("No valid settings provided", 400)
    }

    await saveUserReconciliationConfidencePreferences(tenantId, userId, updates)
    const prefs = await getUserReconciliationConfidencePreferences(tenantId, userId)

    return NextResponse.json({ data: prefs })
  })
}

