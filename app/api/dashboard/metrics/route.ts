import { NextRequest } from "next/server"

import { withAuth, createApiResponse } from "@/lib/api-auth"
import {
  getDashboardMetrics,
  normalizeMetricDateRange,
  type DashboardMetrics,
} from "@/lib/dashboard-metrics"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export type { DashboardMetrics }

export async function GET(request: NextRequest) {
  return withAuth(request, async (req) => {
    const params = request.nextUrl.searchParams
    const range = normalizeMetricDateRange(params.get("from"), params.get("to"))

    return createApiResponse(await getDashboardMetrics(req.user.tenantId, range))
  })
}
