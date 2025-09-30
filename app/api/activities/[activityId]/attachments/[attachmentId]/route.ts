import { NextRequest, NextResponse } from 'next/server'
import { withPermissions, createErrorResponse } from '@/lib/api-auth'
import { getActivityAttachment, removeActivityAttachment } from '@/lib/activity-service'
import { readAttachmentBuffer } from '@/lib/storage'
import { logActivityAudit } from '@/lib/audit'
import { AuditAction } from '@prisma/client'
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

const DELETE_PERMISSIONS = [
  'activities.manage',
  'activities.edit.all',
  'activities.edit.assigned'
]

async function ensureDownloadAccess(
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

  return false
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: { activityId: string; attachmentId: string } }) {
  return withPermissions(
    request,
    VIEW_PERMISSIONS,
    async req => {
      const attachment = await getActivityAttachment(params.attachmentId, req.user.tenantId)
      if (!attachment || attachment.activityId !== params.activityId) {
        return createErrorResponse('Attachment not found', 404)
      }

      const allowed = await ensureDownloadAccess(req.user, attachment.activityId)
      if (allowed !== true) {
        if (allowed && typeof allowed === 'object' && 'error' in allowed) {
          return allowed.error
        }
        return createErrorResponse('Insufficient permissions', 403)
      }

      const buffer = await readAttachmentBuffer(attachment.storageKey)
      await logActivityAudit(
        AuditAction.Update,
        attachment.activityId,
        req.user.id,
        req.user.tenantId,
        request,
        undefined,
        { downloadedAttachment: attachment.fileName }
      )

      const responseBody = new Uint8Array(buffer)

      return new NextResponse(responseBody, {
        headers: {
          'Content-Type': attachment.mimeType,
          'Content-Length': attachment.fileSize.toString(),
          'Content-Disposition': 'attachment; filename="' + encodeURIComponent(attachment.fileName) + '"'
        }
      })
    }
  )
}

export async function DELETE(request: NextRequest, { params }: { params: { activityId: string; attachmentId: string } }) {
  return withPermissions(
    request,
    DELETE_PERMISSIONS,
    async req => {
      try {
        const attachment = await getActivityAttachment(params.attachmentId, req.user.tenantId)
        if (!attachment || attachment.activityId !== params.activityId) {
          return createErrorResponse('Attachment not found', 404)
        }

        const hasGlobal = hasPermission(req.user, 'activities.manage') || hasPermission(req.user, 'activities.edit.all')

        if (!hasGlobal) {
          const activity = await prisma.activity.findFirst({
            where: { id: attachment.activityId, tenantId: req.user.tenantId },
            select: { assigneeId: true, creatorId: true }
          })

          if (!activity) {
            return createErrorResponse('Activity not found', 404)
          }

          const isAssignee = Boolean(activity.assigneeId && activity.assigneeId === req.user.id)
          const isCreator = activity.creatorId === req.user.id

          if (!isAssignee && !isCreator) {
            return createErrorResponse('Insufficient permissions', 403)
          }
        }

        await removeActivityAttachment(params.attachmentId, req.user.tenantId, req.user.id)
        return NextResponse.json({ success: true })
      } catch (error) {
        console.error('Failed to remove attachment', error)
        return createErrorResponse('Failed to remove attachment', 500)
      }
    }
  )
}
