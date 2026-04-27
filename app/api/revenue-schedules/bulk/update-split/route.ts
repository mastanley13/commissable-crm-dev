import { NextRequest, NextResponse } from "next/server"

import { withPermissions } from "@/lib/api-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const BULK_UPDATE_SPLIT_PERMISSIONS = ["revenue-schedules.manage", "opportunities.manage"]

type SplitBody = {
  scheduleIds?: string[]
  effectiveDate?: string
  splits?: {
    house?: number | null
    houseRep?: number | null
    subagent?: number | null
  }
  scope?: "selection" | "series"
}

export async function POST(request: NextRequest) {
  return withPermissions(request, BULK_UPDATE_SPLIT_PERMISSIONS, async () => {
    try {
      const body = (await request.json().catch(() => null)) as SplitBody | null
      if (!body || typeof body !== "object") {
        return NextResponse.json({ error: "Invalid request payload" }, { status: 400 })
      }

      return NextResponse.json(
        {
          error:
            "Revenue schedule split overrides are locked pending a formalized historical snapshot model. Update commission splits from the canonical opportunity flow."
        },
        { status: 409 }
      )
    } catch (error) {
      console.error("Failed to bulk update commission splits", error)
      return NextResponse.json(
        { error: "Unable to update commission splits" },
        { status: 500 }
      )
    }
  })
}
