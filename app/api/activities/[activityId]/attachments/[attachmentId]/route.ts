import { NextRequest, NextResponse } from 'next/server'
import { withPermissions, createErrorResponse } from '@/lib/api-auth'
import { getActivityAttachment, removeActivityAttachment } from '@/lib/activity-service'
import { readAttachmentBuffer } from '@/lib/storage'
import { logActivityAudit } from '@/lib/audit'
import { AuditAction } from '@prisma/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: { activityId: string; attachmentId: string } }) {
  return withPermissions(
    request,
    ['activities.manage', 'activities.read'],
    async req => {
      const attachment = await getActivityAttachment(params.attachmentId, req.user.tenantId)
      if (!attachment || attachment.activityId !== params.activityId) {
        return createErrorResponse('Attachment not found', 404)
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

      return new NextResponse(buffer, {
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
    ['activities.manage'],
    async req => {
      try {
        await removeActivityAttachment(params.attachmentId, req.user.tenantId, req.user.id)
        return NextResponse.json({ success: true })
      } catch (error) {
        console.error('Failed to remove attachment', error)
        return createErrorResponse('Failed to remove attachment', 500)
      }
    }
  )
}
