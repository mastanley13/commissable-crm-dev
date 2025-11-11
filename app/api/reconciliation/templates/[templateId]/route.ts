'use server'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { withPermissions, createErrorResponse } from '@/lib/api-auth'

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
