import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { withPermissions, createErrorResponse } from '@/lib/api-auth'
import { AuditAction } from '@prisma/client'
import { getClientIP, getUserAgent, logAudit } from '@/lib/audit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function mapTemplateDetail(template: any) {
  return {
    id: template.id,
    name: template.name,
    description: template.description ?? '',
    distributorAccountId: template.distributorAccountId,
    distributorName: template.distributor?.accountName ?? '',
    vendorAccountId: template.vendorAccountId,
    vendorName: template.vendor?.accountName ?? '',
    createdByContactId: template.createdByContactId,
    createdByContactName: template.createdByContact?.fullName ?? null,
    createdByUserId: template.createdByUserId,
    createdByUserName: template.createdByUser?.fullName ?? null,
    config: template.config ?? null,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  }
}

export async function GET(request: NextRequest, { params }: { params: { templateId: string } }) {
  return withPermissions(
    request,
    ['reconciliation.view'],
    async (req) => {
      const tenantId = req.user.tenantId
      const templateId = params?.templateId?.trim()

      if (!templateId) {
        return createErrorResponse('Template ID is required', 400)
      }

      const template = await prisma.reconciliationTemplate.findFirst({
        where: {
          id: templateId,
          tenantId,
        },
        include: {
          distributor: { select: { accountName: true } },
          vendor: { select: { accountName: true } },
          createdByContact: { select: { id: true, fullName: true } },
          createdByUser: { select: { id: true, fullName: true } },
        },
      })

      if (!template) {
        return createErrorResponse('Template not found', 404)
      }

      return NextResponse.json({
        data: mapTemplateDetail(template),
      })
    }
  )
}

export async function PATCH(request: NextRequest, { params }: { params: { templateId: string } }) {
  return withPermissions(
    request,
    ['reconciliation.manage'],
    async (req) => {
      const tenantId = req.user.tenantId
      const templateId = params?.templateId?.trim()

      if (!templateId) {
        return createErrorResponse('Template ID is required', 400)
      }

      const body = await request.json().catch(() => null)
      if (!body || typeof body !== 'object') {
        return createErrorResponse('Invalid request body', 400)
      }

      const name = typeof (body as any).name === 'string' ? (body as any).name.trim() : undefined
      const description =
        typeof (body as any).description === 'string' ? (body as any).description.trim() : undefined
      const config = (body as any).config

      const existing = await prisma.reconciliationTemplate.findFirst({
        where: { id: templateId, tenantId },
      })

      if (!existing) {
        return createErrorResponse('Template not found', 404)
      }

      const updated = await prisma.reconciliationTemplate.update({
        where: { id: templateId },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(description !== undefined ? { description: description || null } : {}),
          ...(config !== undefined ? { config } : {}),
        },
        include: {
          distributor: { select: { accountName: true } },
          vendor: { select: { accountName: true } },
          createdByContact: { select: { id: true, fullName: true } },
          createdByUser: { select: { id: true, fullName: true } },
        },
      })

      await logAudit({
        userId: req.user.id,
        tenantId,
        action: AuditAction.Update,
        entityName: 'ReconciliationTemplate',
        entityId: updated.id,
        ipAddress: getClientIP(request),
        userAgent: getUserAgent(request),
        metadata: {
          distributorAccountId: updated.distributorAccountId,
          vendorAccountId: updated.vendorAccountId,
          updatedFields: Object.keys({
            ...(name !== undefined ? { name: true } : {}),
            ...(description !== undefined ? { description: true } : {}),
            ...(config !== undefined ? { config: true } : {}),
          }),
        },
      })

      return NextResponse.json({ data: mapTemplateDetail(updated) })
    }
  )
}
