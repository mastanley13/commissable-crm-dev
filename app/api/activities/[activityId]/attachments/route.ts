import { NextRequest, NextResponse } from 'next/server'
import { withPermissions, createErrorResponse } from '@/lib/api-auth'
import { listActivityAttachments, uploadActivityAttachment } from '@/lib/activity-service'
import { hasPermission } from '@/lib/auth'
import { prisma } from '@/lib/db'

const VIEW_PERMISSIONS = [
  'activities.manage',
  'activities.edit.all',
  'activities.view.all',
  'activities.edit.assigned',
  'activities.view.assigned',
  'activities.create'
]

const MUTATE_PERMISSIONS = [
  'activities.manage',
  'activities.edit.all',
  'activities.edit.assigned',
  'activities.create'
]

async function ensureActivityAccess(
  user: import('@/lib/auth').AuthUser,
  activityId: string,
  mode: 'view' | 'mutate'
) {
  const canAccessAll =
    hasPermission(user, 'activities.manage') ||
    hasPermission(user, 'activities.edit.all') ||
    (mode === 'view' && hasPermission(user, 'activities.view.all'))

  if (canAccessAll) {
    return { activity: null as { assigneeId: string | null; creatorId: string } | null }
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

  if (mode === 'view') {
    if (isAssignee && (hasPermission(user, 'activities.view.assigned') || hasPermission(user, 'activities.edit.assigned'))) {
      return { activity }
    }
    if (isCreator && (hasPermission(user, 'activities.create') || hasPermission(user, 'activities.edit.assigned'))) {
      return { activity }
    }
  } else {
    if (isAssignee && hasPermission(user, 'activities.edit.assigned')) {
      return { activity }
    }
    if (isCreator && (hasPermission(user, 'activities.create') || hasPermission(user, 'activities.edit.assigned'))) {
      return { activity }
    }
  }

  return { error: createErrorResponse('Insufficient permissions', 403) }
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: { activityId: string } }) {
  return withPermissions(
    request,
    VIEW_PERMISSIONS,
    async req => {
      try {
        const access = await ensureActivityAccess(req.user, params.activityId, 'view')
        if (access.error) {
          return access.error
        }
        const attachments = await listActivityAttachments(params.activityId, req.user.tenantId)
        return NextResponse.json({ data: attachments })
      } catch (error) {
        console.error('Failed to load attachments', error)
        return createErrorResponse('Failed to load attachments', 500)
      }
    }
  )
}

export async function POST(request: NextRequest, { params }: { params: { activityId: string } }) {
  return withPermissions(
    request,
    MUTATE_PERMISSIONS,
    async req => {
      try {
        const access = await ensureActivityAccess(req.user, params.activityId, 'mutate')
        if (access.error) {
          return access.error
        }
        const formData = await request.formData()
        const files: File[] = []

        formData.forEach(value => {
          if (value instanceof File) {
            files.push(value)
          }
        })

        if (files.length === 0) {
          return createErrorResponse('No files provided', 400)
        }

        const uploads = []
        for (const file of files) {
          const buffer = Buffer.from(await file.arrayBuffer())
          uploads.push(
            uploadActivityAttachment({
              tenantId: req.user.tenantId,
              activityId: params.activityId,
              userId: req.user.id,
              fileName: file.name,
              mimeType: file.type || 'application/octet-stream',
              buffer
            })
          )
        }

        const results = await Promise.all(uploads)
        return NextResponse.json({ data: results }, { status: 201 })
      } catch (error) {
        console.error('Failed to upload attachment', error)
        return createErrorResponse('Failed to upload attachment', 500)
      }
    }
  )
}
