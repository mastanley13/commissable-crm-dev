import { NextRequest, NextResponse } from "next/server"
import { AuditAction, Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { withPermissions, createErrorResponse } from "@/lib/api-auth"
import { getClientIP, getUserAgent, logAudit } from "@/lib/audit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MANAGE_PERMISSIONS = ["admin.data_settings.manage"]

function mapTemplateRow(template: any) {
  return {
    id: template.id,
    name: template.name,
    description: template.description ?? "",
    distributorAccountId: template.distributorAccountId,
    distributorName: template.distributor?.accountName ?? "",
    vendorAccountId: template.vendorAccountId,
    vendorName: template.vendor?.accountName ?? "",
    createdByUserName: template.createdByUser?.fullName ?? null,
    createdByContactName: template.createdByContact?.fullName ?? null,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
    depositsCount: template._count?.deposits ?? 0,
    config: template.config ?? null,
  }
}

export async function POST(request: NextRequest, { params }: { params: { templateId: string } }) {
  return withPermissions(request, MANAGE_PERMISSIONS, async (req) => {
    const tenantId = req.user.tenantId
    const userId = req.user.id
    const templateId = params?.templateId?.trim()
    if (!templateId) {
      return createErrorResponse("Template ID is required", 400)
    }

    const existing = await prisma.reconciliationTemplate.findFirst({
      where: { tenantId, id: templateId },
      include: {
        distributor: { select: { accountName: true } },
        vendor: { select: { accountName: true } },
        createdByUser: { select: { fullName: true } },
        createdByContact: { select: { fullName: true } },
        _count: { select: { deposits: true } },
      },
    })

    if (!existing) {
      return createErrorResponse("Template not found", 404)
    }

    const baseName = `${existing.name} (Copy)`
    const description = existing.description ?? null
    const config = existing.config ?? Prisma.JsonNull

    let created: any = null
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const suffix = attempt === 0 ? "" : ` ${attempt + 1}`
      const name = `${baseName}${suffix}`
      try {
        created = await prisma.reconciliationTemplate.create({
          data: {
            tenantId,
            name,
            description,
            distributorAccountId: existing.distributorAccountId,
            vendorAccountId: existing.vendorAccountId,
            createdByUserId: userId,
            createdByContactId: null,
            config,
          },
          include: {
            distributor: { select: { accountName: true } },
            vendor: { select: { accountName: true } },
            createdByUser: { select: { fullName: true } },
            createdByContact: { select: { fullName: true } },
            _count: { select: { deposits: true } },
          },
        })
        break
      } catch (error: any) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          continue
        }
        console.error("Failed to clone reconciliation template", error)
        return createErrorResponse("Failed to clone template", 500)
      }
    }

    if (!created) {
      return createErrorResponse("Unable to generate a unique clone name", 409)
    }

    await logAudit({
      userId,
      tenantId,
      action: AuditAction.Create,
      entityName: "ReconciliationTemplate",
      entityId: created.id,
      ipAddress: getClientIP(request),
      userAgent: getUserAgent(request),
      metadata: {
        clonedFromTemplateId: existing.id,
        distributorAccountId: created.distributorAccountId,
        vendorAccountId: created.vendorAccountId,
        name: created.name,
      },
    })

    return NextResponse.json({ data: mapTemplateRow(created) })
  })
}

