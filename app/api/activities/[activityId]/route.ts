import { NextRequest, NextResponse } from 'next/server'
import { ActivityStatus, ActivityType } from '@prisma/client'
import { withPermissions, createErrorResponse } from '@/lib/api-auth'
import { getActivityById, updateActivity, deleteActivity } from '@/lib/activity-service'
import { hasPermission } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function parseEnumValue<T>(value: unknown, allowed: readonly T[]): T | undefined {
  if (typeof value !== 'string') return undefined
  return allowed.find(item => String(item).toLowerCase() === value.toLowerCase())
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string') return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const VIEW_PERMISSIONS = [
  'activities.manage',
  'activities.edit.all',
  'activities.view.all',
  'activities.edit.assigned',
  'activities.view.assigned',
  'activities.create'
]

async function ensureViewAccess(
  user: import('@/lib/auth').AuthUser,
  activityId: string
) {
  const hasGlobal =
    hasPermission(user, 'activities.manage') ||
    hasPermission(user, 'activities.edit.all') ||
    hasPermission(user, 'activities.view.all')

  if (hasGlobal) {
    return true
  }

  const activity = await prisma.activity.findFirst({
    where: { id: activityId, tenantId: user.tenantId },
    select: { assigneeId: true, creatorId: true }
  })

  if (!activity) {
    return { error: createErrorResponse('Activity not found', 404) }
  }

  const isAssignee = Boolean(activity.assigneeId && activity.assigneeId === user.id)
  const isCreator = activity.creatorId === user.id

  if (isAssignee && (hasPermission(user, 'activities.view.assigned') || hasPermission(user, 'activities.edit.assigned'))) {
    return true
  }

  if (isCreator && (hasPermission(user, 'activities.create') || hasPermission(user, 'activities.edit.assigned'))) {
    return true
  }

  return { error: createErrorResponse('Insufficient permissions', 403) }
}

export async function GET(request: NextRequest, { params }: { params: { activityId: string } }) {
  return withPermissions(
    request,
    VIEW_PERMISSIONS,
    async req => {
      const access = await ensureViewAccess(req.user, params.activityId)
      if (access !== true) {
        return access.error
      }

      const activity = await getActivityById(params.activityId, req.user.tenantId)
      if (!activity) {
        return createErrorResponse('Activity not found', 404)
      }
      return NextResponse.json({ data: activity })
    }
  )
}

export async function PATCH(request: NextRequest, { params }: { params: { activityId: string } }) {
  return withPermissions(
    request,
    ['activities.manage'],
    async req => {
      try {
        const payload = await request.json()
        const type = parseEnumValue<ActivityType>(payload.type, Object.values(ActivityType))
        const status = parseEnumValue<ActivityStatus>(payload.status, Object.values(ActivityStatus))

        const activity = await updateActivity({
          activityId: params.activityId,
          tenantId: req.user.tenantId,
          userId: req.user.id,
          subject: typeof payload.subject === 'string' ? payload.subject.trim() : undefined,
          type,
          description: typeof payload.description === 'string' ? payload.description : undefined,
          location: typeof payload.location === 'string' ? payload.location : undefined,
          dueDate: payload.dueDate !== undefined ? parseDate(payload.dueDate) : undefined,
          assigneeId: typeof payload.assigneeId === 'string' ? payload.assigneeId : undefined,
          status,
          accountId: typeof payload.accountId === 'string' ? payload.accountId : undefined,
          contactId: typeof payload.contactId === 'string' ? payload.contactId : undefined,
          opportunityId: typeof payload.opportunityId === 'string' ? payload.opportunityId : undefined,
          revenueScheduleId: typeof payload.revenueScheduleId === 'string' ? payload.revenueScheduleId : undefined
        })

        return NextResponse.json({ data: activity })
      } catch (error) {
        console.error('Failed to update activity', error)
        return createErrorResponse('Failed to update activity', 500)
      }
    }
  )
}

export async function DELETE(request: NextRequest, { params }: { params: { activityId: string } }) {
  return withPermissions(
    request,
    ['activities.manage'],
    async req => {
      try {
        await deleteActivity(params.activityId, req.user.tenantId, req.user.id)
        return NextResponse.json({ success: true })
      } catch (error) {
        console.error('Failed to delete activity', error)
        return createErrorResponse('Failed to delete activity', 500)
      }
    }
  )
}
