import { NextRequest, NextResponse } from "next/server"
import { AuditAction, Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { withPermissions, createErrorResponse } from "@/lib/api-auth"
import { getClientIP, getUserAgent, logAudit } from "@/lib/audit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MANAGE_PERMISSIONS = ["admin.data_settings.manage"]

function mapTemplateDetail(template: any) {
  return {
    id: template.id,
    name: template.name,
    description: template.description ?? "",
    distributorAccountId: template.distributorAccountId,
    distributorName: template.distributor?.accountName ?? "",
    vendorAccountId: template.vendorAccountId,
    vendorName: template.vendor?.accountName ?? "",
    createdByContactId: template.createdByContactId,
    createdByContactName: template.createdByContact?.fullName ?? null,
    createdByUserId: template.createdByUserId,
    createdByUserName: template.createdByUser?.fullName ?? null,
    config: template.config ?? null,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
    depositsCount: template._count?.deposits ?? 0,
  }
}

export async function GET(request: NextRequest, { params }: { params: { templateId: string } }) {
  return withPermissions(request, MANAGE_PERMISSIONS, async (req) => {
    const tenantId = req.user.tenantId
    const templateId = params?.templateId?.trim()
    if (!templateId) {
      return createErrorResponse("Template ID is required", 400)
    }

    try {
      const template = await prisma.reconciliationTemplate.findFirst({
        where: { id: templateId, tenantId },
        include: {
          distributor: { select: { accountName: true } },
          vendor: { select: { accountName: true } },
          createdByContact: { select: { fullName: true } },
          createdByUser: { select: { fullName: true } },
          _count: { select: { deposits: true } },
        },
      })

      if (!template) {
        return createErrorResponse("Template not found", 404)
      }

      return NextResponse.json({ data: mapTemplateDetail(template) })
    } catch (error) {
      console.error("Failed to load reconciliation template", error)
      return createErrorResponse("Failed to load template", 500)
    }
  })
}

export async function PATCH(request: NextRequest, { params }: { params: { templateId: string } }) {
  return withPermissions(request, MANAGE_PERMISSIONS, async (req) => {
    const tenantId = req.user.tenantId
    const templateId = params?.templateId?.trim()
    if (!templateId) {
      return createErrorResponse("Template ID is required", 400)
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return createErrorResponse("Invalid request body", 400)
    }

    const name = typeof (body as any).name === "string" ? (body as any).name.trim() : undefined
    const description = typeof (body as any).description === "string" ? (body as any).description.trim() : undefined
    const config = (body as any).config

    if (name !== undefined && !name) {
      return createErrorResponse("Template name is required", 400)
    }

    try {
      const existing = await prisma.reconciliationTemplate.findFirst({
        where: { id: templateId, tenantId },
        select: { id: true, distributorAccountId: true, vendorAccountId: true },
      })

      if (!existing) {
        return createErrorResponse("Template not found", 404)
      }

      const updated = await prisma.reconciliationTemplate.update({
        where: { id: templateId },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(description !== undefined ? { description: description || null } : {}),
          ...(config !== undefined ? { config: config === null ? Prisma.JsonNull : config } : {}),
        },
        include: {
          distributor: { select: { accountName: true } },
          vendor: { select: { accountName: true } },
          createdByContact: { select: { fullName: true } },
          createdByUser: { select: { fullName: true } },
          _count: { select: { deposits: true } },
        },
      })

      await logAudit({
        userId: req.user.id,
        tenantId,
        action: AuditAction.Update,
        entityName: "ReconciliationTemplate",
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
    } catch (error: any) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return createErrorResponse("Template already exists for this distributor/vendor/name", 409)
      }
      console.error("Failed to update reconciliation template", error)
      return createErrorResponse("Failed to update template", 500)
    }
  })
}

