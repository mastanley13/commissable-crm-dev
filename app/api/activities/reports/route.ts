import { NextRequest, NextResponse } from 'next/server'
import { withPermissions, createErrorResponse } from '@/lib/api-auth'
import { getActivityReport } from '@/lib/activity-service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  return withPermissions(
    request,
    ['activities.manage', 'activities.read'],
    async req => {
      try {
        const report = await getActivityReport(req.user.tenantId)
        return NextResponse.json({ data: report })
      } catch (error) {
        console.error('Failed to generate activity report', error)
        return createErrorResponse('Failed to generate activity report', 500)
      }
    }
  )
}
