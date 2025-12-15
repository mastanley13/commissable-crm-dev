import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { withPermissions, createErrorResponse } from "@/lib/api-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MANAGE_PERMISSIONS = ["admin.data_settings.manage"]

const DEFAULT_PRODUCT_SUBTYPES = [
  {
    code: "BACKUP_SERVICES",
    name: "Backup Services"
  },
  {
    code: "CABLE",
    name: "Cable"
  },
  {
    code: "CCAAS",
    name: "CCaaS (Call Center as a Service)"
  },
  {
    code: "ETHERNET",
    name: "Ethernet"
  },
  {
    code: "FIBER",
    name: "Fiber"
  },
  {
    code: "MAINTENANCE_SERVICES",
    name: "Maintenance Services"
  },
  {
    code: "MANAGED_SERVICES",
    name: "Managed Services"
  },
  {
    code: "NETWORKING",
    name: "Networking"
  },
  {
    code: "POTS",
    name: "POTS (Plain Old Telephone Service)"
  },
  {
    code: "SATELLITE",
    name: "Satellite"
  },
  {
    code: "SERVERS_STORAGE",
    name: "Servers & Storage"
  },
  {
    code: "UCAAS",
    name: "UCaaS (Unified Communications as a Service)"
  },
  {
    code: "WIFI",
    name: "WiFi"
  }
] as const

function normalizeCode(value: string): string {
  return value
    .trim()
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase()
}

async function ensureDefaultProductSubtypes(tenantId: string) {
  for (let index = 0; index < DEFAULT_PRODUCT_SUBTYPES.length; index += 1) {
    const def = DEFAULT_PRODUCT_SUBTYPES[index]
    // eslint-disable-next-line no-await-in-loop
    await prisma.productSubtype.upsert({
      where: {
        tenantId_code: {
          tenantId,
          code: def.code
        }
      },
      update: {},
      create: {
        tenantId,
        code: def.code,
        name: def.name,
        description: null,
        isActive: true,
        isSystem: true,
        displayOrder: (index + 1) * 10,
        productFamilyId: null
      }
    })
  }
}

export async function GET(request: NextRequest) {
  return withPermissions(
    request,
    MANAGE_PERMISSIONS,
    async (req) => {
      const tenantId = req.user.tenantId
      const url = new URL(request.url)
      const includeInactive = url.searchParams.get("includeInactive") === "true"

      try {
        await ensureDefaultProductSubtypes(tenantId)

        const subtypes = await prisma.productSubtype.findMany({
          where: {
            tenantId,
            ...(includeInactive ? {} : { isActive: true })
          },
          orderBy: { displayOrder: "asc" },
          include: {
            family: {
              select: { id: true, name: true }
            }
          }
        })

        return NextResponse.json({ data: subtypes })
      } catch (error) {
        console.error("Failed to load product subtypes", error)
        return createErrorResponse("Failed to load product subtypes", 500)
      }
    }
  )
}

export async function POST(request: NextRequest) {
  return withPermissions(
    request,
    MANAGE_PERMISSIONS,
    async (req) => {
      const tenantId = req.user.tenantId
      const body = await request.json()

      const name = typeof body.name === "string" ? body.name.trim() : ""
      const rawCode = typeof body.code === "string" ? body.code.trim() : ""
      const description =
        typeof body.description === "string" && body.description.trim().length > 0
          ? body.description.trim()
          : null
      const isActive =
        typeof body.isActive === "boolean" ? body.isActive : true
      const displayOrder =
        typeof body.displayOrder === "number" ? body.displayOrder : 1000
      const productFamilyId =
        typeof body.productFamilyId === "string" && body.productFamilyId.trim().length > 0
          ? body.productFamilyId.trim()
          : null

      if (!name) {
        return createErrorResponse("Name is required", 400)
      }

      const code = normalizeCode(rawCode || name)

      try {
        const subtype = await prisma.productSubtype.create({
          data: {
            tenantId,
            name,
            code,
            description,
            isActive,
            isSystem: false,
            displayOrder,
            productFamilyId
          }
        })

        return NextResponse.json({ data: subtype }, { status: 201 })
      } catch (error) {
        console.error("Failed to create product subtype", error)
        return createErrorResponse("Failed to create product subtype", 500)
      }
    }
  )
}

export async function PATCH(request: NextRequest) {
  return withPermissions(
    request,
    MANAGE_PERMISSIONS,
    async (req) => {
      const tenantId = req.user.tenantId
      const body = await request.json()

      const id = typeof body.id === "string" ? body.id : null
      if (!id) {
        return createErrorResponse("Product subtype id is required", 400)
      }

      try {
        const existing = await prisma.productSubtype.findFirst({
          where: { id, tenantId }
        })

        if (!existing) {
          return createErrorResponse("Product subtype not found", 404)
        }

        const data: any = {}

        if (typeof body.name === "string") {
          const name = body.name.trim()
          if (name && name !== existing.name) {
            data.name = name
          }
        }

        if (typeof body.description === "string") {
          const description = body.description.trim()
          data.description = description.length > 0 ? description : null
        }

        if (typeof body.isActive === "boolean") {
          data.isActive = body.isActive
        }

        if (typeof body.displayOrder === "number") {
          data.displayOrder = body.displayOrder
        }

        if (typeof body.productFamilyId === "string") {
          const familyId = body.productFamilyId.trim()
          data.productFamilyId = familyId.length > 0 ? familyId : null
        }

        // Do not allow changing code or isSystem via this endpoint

        if (Object.keys(data).length === 0) {
          return NextResponse.json({ data: existing })
        }

        const updated = await prisma.productSubtype.update({
          where: { id: existing.id },
          data
        })

        return NextResponse.json({ data: updated })
      } catch (error) {
        console.error("Failed to update product subtype", error)
        return createErrorResponse("Failed to update product subtype", 500)
      }
    }
  )
}
