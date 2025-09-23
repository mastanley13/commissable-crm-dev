import { NextRequest, NextResponse } from 'next/server'
import { ActivityEntityType, ActivityStatus, ActivityType } from '@prisma/client'
import { withPermissions, createErrorResponse } from '@/lib/api-auth'
import { listActivities, createActivity } from '@/lib/activity-service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function parseEnumValue<T>(value: string | null, allowed: readonly T[]): T | undefined {
  if (!value) return undefined
  return allowed.find(item => String(item).toLowerCase() === value.toLowerCase())
}

export async function GET(request: NextRequest) {
  return withPermissions(
    request,
    ['activities.manage', 'activities.read'],
    async req => {
      const searchParams = request.nextUrl.searchParams
      const tenantId = req.user.tenantId

      const page = Number(searchParams.get('page') ?? '1')
      const pageSize = Number(searchParams.get('pageSize') ?? '25')
      const search = searchParams.get('search') ?? undefined
      const typeParam = searchParams.get('type')
      const statusParam = searchParams.get('status')
      const includeCompleted = searchParams.get('includeCompleted') === 'true'
      const contextTypeParam = searchParams.get('contextType')
      const contextId = searchParams.get('contextId') ?? undefined
      const sortBy = searchParams.get('sortBy') === 'createdAt' ? 'createdAt' : 'dueDate'
      const sortDirection = searchParams.get('sortDirection') === 'asc' ? 'asc' : 'desc'

      const type = parseEnumValue<ActivityType>(typeParam, Object.values(ActivityType))
      const status = parseEnumValue<ActivityStatus>(statusParam, Object.values(ActivityStatus))
      const contextType = parseEnumValue<ActivityEntityType>(contextTypeParam, Object.values(ActivityEntityType))

      const result = await listActivities(tenantId, {
        page,
        pageSize,
        search,
        type,
        status,
        includeCompleted,
        contextType,
        contextId,
        sortBy,
        sortDirection
      })

      return NextResponse.json({ data: result.data, pagination: result.pagination })
    }
  )
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string') return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export async function POST(request: NextRequest) {
  return withPermissions(
    request,
    ['activities.manage'],
    async req => {
      try {
        const payload = await request.json()

        const type = parseEnumValue<ActivityType>(payload.type, Object.values(ActivityType))
        if (!type) {
          return createErrorResponse('Invalid activity type', 400)
        }

        const status = payload.status
          ? parseEnumValue<ActivityStatus>(payload.status, Object.values(ActivityStatus)) ?? ActivityStatus.Open
          : ActivityStatus.Open

        const subject = typeof payload.subject === 'string' ? payload.subject.trim() : ''
        if (!subject) {
          return createErrorResponse('Subject is required', 400)
        }

        const activity = await createActivity({
          tenantId: req.user.tenantId,
          userId: req.user.id,
          subject,
          type,
          description: typeof payload.description === 'string' ? payload.description : null,
          location: typeof payload.location === 'string' ? payload.location : null,
          dueDate: parseDate(payload.dueDate),
          assigneeId: typeof payload.assigneeId === 'string' ? payload.assigneeId : null,
          status,
          accountId: typeof payload.accountId === 'string' ? payload.accountId : null,
          contactId: typeof payload.contactId === 'string' ? payload.contactId : null,
          opportunityId: typeof payload.opportunityId === 'string' ? payload.opportunityId : null,
          revenueScheduleId: typeof payload.revenueScheduleId === 'string' ? payload.revenueScheduleId : null
        })

        return NextResponse.json({ data: activity }, { status: 201 })
      } catch (error) {
        console.error('Failed to create activity', error)
        return createErrorResponse('Failed to create activity', 500)
      }
    }
  )
}
