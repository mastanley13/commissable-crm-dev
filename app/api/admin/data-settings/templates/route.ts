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

export async function GET(request: NextRequest) {
  return withPermissions(request, MANAGE_PERMISSIONS, async (req) => {
    const tenantId = req.user.tenantId
    const url = new URL(request.url)

    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"))
    const pageSize = Math.min(Math.max(Number(url.searchParams.get("pageSize") ?? "25"), 1), 100)
    const query = url.searchParams.get("q")?.trim() ?? ""
    const distributorAccountId = url.searchParams.get("distributorAccountId")?.trim() ?? ""
    const vendorAccountId = url.searchParams.get("vendorAccountId")?.trim() ?? ""

    const whereClause: Record<string, unknown> = { tenantId }
    if (query.length > 0) {
      whereClause.name = { contains: query, mode: "insensitive" }
    }
    if (distributorAccountId) {
      whereClause.distributorAccountId = distributorAccountId
    }
    if (vendorAccountId) {
      whereClause.vendorAccountId = vendorAccountId
    }

    try {
      const skip = (page - 1) * pageSize

      const [total, templates] = await Promise.all([
        prisma.reconciliationTemplate.count({ where: whereClause }),
        prisma.reconciliationTemplate.findMany({
          where: whereClause,
          include: {
            distributor: { select: { accountName: true } },
            vendor: { select: { accountName: true } },
            createdByUser: { select: { fullName: true } },
            createdByContact: { select: { fullName: true } },
            _count: { select: { deposits: true } },
          },
          orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
          skip,
          take: pageSize,
        }),
      ])

      return NextResponse.json({
        data: templates.map(mapTemplateRow),
        pagination: { page, pageSize, total },
      })
    } catch (error) {
      console.error("Failed to load reconciliation templates", error)
      return createErrorResponse("Failed to load templates", 500)
    }
  })
}

export async function POST(request: NextRequest) {
  return withPermissions(request, MANAGE_PERMISSIONS, async (req) => {
    try {
      const tenantId = req.user.tenantId
      const userId = req.user.id
      const body = await request.json().catch(() => null)
      if (!body || typeof body !== "object") {
        return createErrorResponse("Invalid request body", 400)
      }

      const nameRaw = typeof (body as any).name === "string" ? (body as any).name.trim() : ""
      const descriptionRaw =
        typeof (body as any).description === "string" ? (body as any).description.trim() : ""
      const distributorAccountId =
        typeof (body as any).distributorAccountId === "string" ? (body as any).distributorAccountId.trim() : ""
      const vendorAccountId =
        typeof (body as any).vendorAccountId === "string" ? (body as any).vendorAccountId.trim() : ""
      const createdByContactId =
        typeof (body as any).createdByContactId === "string" ? (body as any).createdByContactId.trim() : ""
      const config = (body as any).config

      if (!nameRaw) {
        return createErrorResponse("Template name is required", 400)
      }
      if (!distributorAccountId || !vendorAccountId) {
        return createErrorResponse("Distributor and vendor are required", 400)
      }

      const [distributor, vendor, contact] = await Promise.all([
        prisma.account.findFirst({ where: { id: distributorAccountId, tenantId }, select: { id: true } }),
        prisma.account.findFirst({ where: { id: vendorAccountId, tenantId }, select: { id: true } }),
        createdByContactId
          ? prisma.contact.findFirst({ where: { id: createdByContactId, tenantId }, select: { id: true } })
          : Promise.resolve(null),
      ])

      if (!distributor) {
        return createErrorResponse("Distributor account not found", 404)
      }
      if (!vendor) {
        return createErrorResponse("Vendor account not found", 404)
      }
      if (createdByContactId && !contact) {
        return createErrorResponse("Created By contact not found", 404)
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
          config: config === null ? Prisma.JsonNull : (config ?? Prisma.JsonNull),
        },
        include: {
          distributor: { select: { accountName: true } },
          vendor: { select: { accountName: true } },
          createdByUser: { select: { fullName: true } },
          createdByContact: { select: { fullName: true } },
          _count: { select: { deposits: true } },
        },
      })

      await logAudit({
        userId,
        tenantId,
        action: AuditAction.Create,
        entityName: "ReconciliationTemplate",
        entityId: template.id,
        ipAddress: getClientIP(request),
        userAgent: getUserAgent(request),
        metadata: {
          distributorAccountId: template.distributorAccountId,
          vendorAccountId: template.vendorAccountId,
          name: template.name,
        },
      })

      return NextResponse.json({ data: mapTemplateRow(template) })
    } catch (error: any) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return createErrorResponse("Template already exists for this distributor/vendor/name", 409)
      }
      console.error("Failed to create reconciliation template", error)
      return createErrorResponse("Failed to create template", 500)
    }
  })
}

