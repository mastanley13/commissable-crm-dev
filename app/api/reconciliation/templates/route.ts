import { AuditAction, Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { withPermissions, createErrorResponse } from '@/lib/api-auth'
import { getClientIP, getUserAgent, logAudit } from '@/lib/audit'
import { findTelarusTemplateMatch } from '@/lib/deposit-import/telarus-template-master'
import { serializeDepositMappingForTemplate } from '@/lib/deposit-import/template-mapping'
import {
  serializeTelarusTemplateFieldsForTemplate,
} from '@/lib/deposit-import/telarus-template-fields'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function mapTemplate(template: any) {
  return {
    id: template.id,
    name: template.name,
    description: template.description ?? '',
    distributorAccountId: template.distributorAccountId,
    distributorName: template.distributor?.accountName ?? '',
    vendorAccountId: template.vendorAccountId,
    vendorName: template.vendor?.accountName ?? '',
    config: template.config ?? null,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  }
}

export async function GET(request: NextRequest) {
  return withPermissions(
    request,
    ['reconciliation.view'],
    async (req) => {
      const tenantId = req.user.tenantId
      const searchParams = request.nextUrl.searchParams
      const distributorAccountId = searchParams.get('distributorAccountId')
      const vendorAccountId = searchParams.get('vendorAccountId')
      const query = searchParams.get('q')?.trim() ?? ''
      const take = Math.min(Math.max(Number(searchParams.get('pageSize') ?? '25'), 1), 100)

      if (!distributorAccountId || !vendorAccountId) {
        return NextResponse.json({ data: [], pagination: { pageSize: take, total: 0 } })
      }

      const whereClause: Record<string, unknown> = {
        tenantId,
        distributorAccountId,
        vendorAccountId,
      }

      if (query.length > 0) {
        whereClause.name = { contains: query, mode: 'insensitive' }
      }

      const templates = await prisma.reconciliationTemplate.findMany({
        where: whereClause,
        include: {
          distributor: { select: { accountName: true } },
          vendor: { select: { accountName: true } },
        },
        orderBy: { name: 'asc' },
        take,
      })

      let resolvedTemplates = templates

      // Seed a Telarus-derived template when none exist, but avoid mutating existing templates during list requests.
      if (query.length === 0 && templates.length === 0) {
        const [distributor, vendor] = await Promise.all([
          prisma.account.findFirst({
            where: { tenantId, id: distributorAccountId },
            select: { accountName: true },
          }),
          prisma.account.findFirst({
            where: { tenantId, id: vendorAccountId },
            select: { accountName: true },
          }),
        ])

        const match =
          distributor?.accountName && vendor?.accountName
            ? findTelarusTemplateMatch({
                distributorName: distributor.accountName,
                vendorName: vendor.accountName,
              })
            : null

        if (match) {
          const config: Prisma.InputJsonValue = {
            ...(serializeDepositMappingForTemplate(match.mapping) as unknown as Prisma.JsonObject),
            ...(serializeTelarusTemplateFieldsForTemplate(match.templateFields) as unknown as Prisma.JsonObject),
            telarusTemplateId: match.templateId,
            telarusOrigin: match.origin,
            telarusCompanyName: match.companyName,
            telarusTemplateMapName: match.templateMapName,
          } as unknown as Prisma.InputJsonValue

          try {
            const created = await prisma.reconciliationTemplate.create({
              data: {
                tenantId,
                name: match.templateMapName,
                description: 'Seeded from Telarus vendor map fields master CSV.',
                distributorAccountId,
                vendorAccountId,
                createdByUserId: req.user.id,
                createdByContactId: null,
                config,
              },
              include: {
                distributor: { select: { accountName: true } },
                vendor: { select: { accountName: true } },
              },
            })
            resolvedTemplates = [created]
          } catch (error: any) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
              // A template may have been created concurrently; return the latest list.
              resolvedTemplates = await prisma.reconciliationTemplate.findMany({
                where: whereClause,
                include: {
                  distributor: { select: { accountName: true } },
                  vendor: { select: { accountName: true } },
                },
                orderBy: { name: 'asc' },
                take,
              })
            } else {
              console.error('Failed to seed reconciliation template from Telarus CSV', error)
            }
          }
        }
      }

      return NextResponse.json({
        data: resolvedTemplates.map(mapTemplate),
        pagination: {
          total: resolvedTemplates.length,
          pageSize: take,
        },
      })
    }
  )
}

export async function POST(request: NextRequest) {
  return withPermissions(
    request,
    ['reconciliation.manage'],
    async (req) => {
      try {
        const body = await request.json()
        const tenantId = req.user.tenantId
        const userId = req.user.id

        const distributorAccountId = typeof body?.distributorAccountId === 'string' ? body.distributorAccountId.trim() : ''
        const vendorAccountId = typeof body?.vendorAccountId === 'string' ? body.vendorAccountId.trim() : ''
        const createdByContactId = typeof body?.createdByContactId === 'string' ? body.createdByContactId.trim() : ''
        const nameRaw = typeof body?.name === 'string' ? body.name.trim() : ''
        const descriptionRaw = typeof body?.description === 'string' ? body.description.trim() : ''
        const config = body?.config

        if (!nameRaw) {
          return createErrorResponse('Template name is required', 400)
        }

        if (!distributorAccountId || !vendorAccountId) {
          return createErrorResponse('Distributor and vendor are required', 400)
        }

        const [distributor, vendor, contact] = await Promise.all([
          prisma.account.findFirst({ where: { id: distributorAccountId, tenantId }, select: { id: true, accountName: true } }),
          prisma.account.findFirst({ where: { id: vendorAccountId, tenantId }, select: { id: true, accountName: true } }),
          createdByContactId
            ? prisma.contact.findFirst({ where: { id: createdByContactId, tenantId }, select: { id: true } })
            : Promise.resolve(null),
        ])

        if (!distributor) {
          return createErrorResponse('Distributor account not found', 404)
        }
        if (!vendor) {
          return createErrorResponse('Vendor account not found', 404)
        }
        if (createdByContactId && !contact) {
          return createErrorResponse('Created By contact not found', 404)
        }

        const template = await prisma.reconciliationTemplate.create({
          data: {
            tenantId,
            name: nameRaw,
            description: descriptionRaw || null,
            distributorAccountId: distributor.id,
            vendorAccountId: vendor.id,
            createdByUserId: userId,
            createdByContactId: contact?.id ?? null,
            config: config ?? Prisma.JsonNull,
          },
          include: {
            distributor: { select: { accountName: true } },
            vendor: { select: { accountName: true } },
          },
        })

        await logAudit({
          userId,
          tenantId,
          action: AuditAction.Create,
          entityName: 'ReconciliationTemplate',
          entityId: template.id,
          ipAddress: getClientIP(request),
          userAgent: getUserAgent(request),
          metadata: {
            distributorAccountId: template.distributorAccountId,
            vendorAccountId: template.vendorAccountId,
            name: template.name,
          },
        })

        return NextResponse.json({
          data: mapTemplate(template),
          message: 'Template created',
        })
      } catch (error: any) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          return createErrorResponse('Template already exists for this distributor/vendor/name', 409)
        }

        console.error('Failed to create reconciliation template', error)
        return createErrorResponse('Failed to create template', 500)
      }
    }
  )
}
