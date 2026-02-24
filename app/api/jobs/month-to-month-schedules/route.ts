import { NextRequest, NextResponse } from "next/server"
import { processMonthToMonthSchedules } from "@/jobs/month-to-month-schedule-runner"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.JOB_SECRET
  if (!secret) return false
  const provided = request.headers.get("x-job-secret")
  return Boolean(provided && provided === secret)
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(request.url)
  const rawDate = url.searchParams.get("date")
  const rawDryRun = url.searchParams.get("dryRun")
  const rawThreshold = url.searchParams.get("noDepositThresholdMonths")
  const referenceDate = rawDate ? new Date(rawDate) : new Date()
  if (Number.isNaN(referenceDate.getTime())) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 })
  }

  const dryRun =
    typeof rawDryRun === "string" &&
    ["1", "true", "yes", "y", "on"].includes(rawDryRun.trim().toLowerCase())

  let noDepositThresholdMonths: number | undefined = undefined
  if (rawThreshold != null && rawThreshold.trim().length > 0) {
    const parsed = Number(rawThreshold)
    if (!Number.isFinite(parsed) || parsed < 1) {
      return NextResponse.json(
        { error: "noDepositThresholdMonths must be a positive integer" },
        { status: 400 },
      )
    }
    noDepositThresholdMonths = Math.floor(parsed)
  }

  const result = await processMonthToMonthSchedules(referenceDate, {
    dryRun,
    noDepositThresholdMonths,
  })
  return NextResponse.json({ data: result })
}
