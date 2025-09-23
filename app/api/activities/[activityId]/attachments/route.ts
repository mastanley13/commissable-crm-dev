import { NextRequest, NextResponse } from 'next/server'
import { withPermissions, createErrorResponse } from '@/lib/api-auth'
import { listActivityAttachments, uploadActivityAttachment } from '@/lib/activity-service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: { activityId: string } }) {
  return withPermissions(
    request,
    ['activities.manage', 'activities.read'],
    async req => {
      try {
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
    ['activities.manage'],
    async req => {
      try {
        const formData = await request.formData()
        const files: File[] = []

        for (const value of formData.values()) {
          if (value instanceof File) {
            files.push(value)
          }
        }

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
