import { NextRequest, NextResponse } from "next/server"
import {
  processFlexReviewDigestForAllTenants,
  processFlexReviewDigestForTenant,
} from "@/jobs/flex-review-digest-runner"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.JOB_SECRET
  if (!secret) return false
  const provided = request.headers.get("x-job-secret")
  return Boolean(provided && provided === secret)
}

function parseNumber(value: string | null, fallback: number): number {
  if (!value) return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(request.url)
  const minAgeDays = Math.max(0, parseNumber(url.searchParams.get("minAgeDays"), 7))
  const dryRun = url.searchParams.get("dryRun") === "true"
  const tenantId = url.searchParams.get("tenantId")?.trim()

  if (tenantId) {
    const result = await processFlexReviewDigestForTenant(tenantId, { minAgeDays, dryRun })
    return NextResponse.json({ data: result })
  }

  const results = await processFlexReviewDigestForAllTenants({ minAgeDays, dryRun })
  const createdCount = results.reduce((sum, row) => sum + row.createdCount, 0)

  return NextResponse.json({
    data: {
      dryRun,
      tenantCount: results.length,
      createdCount,
      minAgeDays,
      results,
    },
  })
}
