import { NextRequest } from "next/server"
import { withPermissions, createApiResponse } from "@/lib/api-auth"
import {
  getAdminOverviewMetrics,
  type AdminOverviewMetrics,
} from "@/lib/dashboard-metrics"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export type { AdminOverviewMetrics }

export async function GET(request: NextRequest) {
  return withPermissions(
    request,
    ["admin.users.read"],
    async (req) => {
      return createApiResponse(await getAdminOverviewMetrics(req.user.tenantId))
    }
  )
}
