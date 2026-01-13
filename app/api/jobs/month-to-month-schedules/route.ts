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
  const referenceDate = rawDate ? new Date(rawDate) : new Date()
  if (Number.isNaN(referenceDate.getTime())) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 })
  }

  const createdCount = await processMonthToMonthSchedules(referenceDate)
  return NextResponse.json({ data: { createdCount } })
}

