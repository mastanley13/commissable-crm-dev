import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { withPermissions, createErrorResponse } from "@/lib/api-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MANAGE_PERMISSIONS = ["admin.data_settings.manage"]

const DEFAULT_PRODUCT_FAMILIES = [
  {
    code: "AI_SERVICES",
    name: "AI Services",
    description:
      "AI-based services such as automation, assistants, and intelligent analytics."
  },
  {
    code: "INTERNET_VOICE",
    name: "Internet & Voice Connectivity",
    description: "Core internet, voice, and connectivity services."
  },
  {
    code: "CYBERSECURITY",
    name: "Cybersecurity Services",
    description: "Security offerings including threat protection and monitoring."
  },
  {
    code: "DATA_PROTECTION",
    name: "Data Protection",
    description: "Backup, archiving, and data protection solutions."
  },
  {
    code: "HARDWARE",
    name: "Hardware Products",
    description: "Physical devices, infrastructure, and related equipment."
  },
  {
    code: "INSTALLATION",
    name: "Installation Services",
    description: "Implementation, installation, and turn-up services."
  },
  {
    code: "MAINTENANCE",
    name: "Maintenance Products",
    description: "Maintenance contracts and support entitlements."
  },
  {
    code: "SOFTWARE",
    name: "Software Products",
    description: "Software licenses, subscriptions, and SaaS products."
  }
] as const

function normalizeCode(value: string): string {
  return value
    .trim()
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase()
}

async function ensureDefaultProductFamilies(tenantId: string) {
  // Use individual upserts so the logic stays simple and works cleanly
  // with the lazy Prisma proxy used in the app. This is still idempotent
  // and safe under concurrency for our small, static seed set.
  for (let index = 0; index < DEFAULT_PRODUCT_FAMILIES.length; index += 1) {
    const def = DEFAULT_PRODUCT_FAMILIES[index]
    // eslint-disable-next-line no-await-in-loop
    await prisma.productFamily.upsert({
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
        description: def.description,
        isActive: true,
        isSystem: true,
        displayOrder: (index + 1) * 10
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
        await ensureDefaultProductFamilies(tenantId)

        const families = await prisma.productFamily.findMany({
          where: {
            tenantId,
            ...(includeInactive ? {} : { isActive: true })
          },
          orderBy: { name: "asc" },
          include: {
            _count: {
              select: {
                subtypes: true
              }
            }
          }
        })

        const data = families.map(family => ({
          id: family.id,
          tenantId: family.tenantId,
          code: family.code,
          name: family.name,
          description: family.description,
          isActive: family.isActive,
          isSystem: family.isSystem,
          displayOrder: family.displayOrder,
          createdAt: family.createdAt,
          updatedAt: family.updatedAt,
          usageCount: family._count?.subtypes ?? 0
        }))

        return NextResponse.json({ data })
      } catch (error) {
        console.error("Failed to load product families", error)
        return createErrorResponse("Failed to load product family types", 500)
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

      if (!name) {
        return createErrorResponse("Name is required", 400)
      }

      const code = normalizeCode(rawCode || name)

      try {
        const family = await prisma.productFamily.create({
          data: {
            tenantId,
            name,
            code,
            description,
            isActive,
            isSystem: false,
            displayOrder
          }
        })

        return NextResponse.json({ data: family }, { status: 201 })
      } catch (error) {
        console.error("Failed to create product family", error)
        return createErrorResponse("Failed to create product family type", 500)
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
        return createErrorResponse("Product family id is required", 400)
      }

      try {
        const existing = await prisma.productFamily.findFirst({
          where: { id, tenantId }
        })

        if (!existing) {
          return createErrorResponse("Product family not found", 404)
        }

        const data: any = {}

        if (typeof body.name === "string") {
          const name = body.name.trim()
          if (name && name !== existing.name) {
            data.name = name
          }
        }

        if (typeof body.code === "string") {
          const rawCode = body.code.trim()
          if (rawCode.length > 0) {
            const normalizedCode = normalizeCode(rawCode)
            if (normalizedCode && normalizedCode !== existing.code) {
              const conflicting = await prisma.productFamily.findFirst({
                where: {
                  tenantId,
                  code: normalizedCode,
                  NOT: { id: existing.id }
                }
              })

              if (conflicting) {
                return createErrorResponse(
                  "Another product family already uses this code",
                  400
                )
              }

              data.code = normalizedCode
            }
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

        if (Object.keys(data).length === 0) {
          return NextResponse.json({ data: existing })
        }

        const updated = await prisma.productFamily.update({
          where: { id: existing.id },
          data
        })

        return NextResponse.json({ data: updated })
      } catch (error) {
        console.error("Failed to update product family", error)
        return createErrorResponse("Failed to update product family type", 500)
      }
    }
  )
}

export async function DELETE(request: NextRequest) {
  return withPermissions(
    request,
    MANAGE_PERMISSIONS,
    async (req) => {
      const tenantId = req.user.tenantId

      let body: any = null
      try {
        body = await request.json()
      } catch {
        // Ignore parse errors and handle as missing id below
      }

      const id = body && typeof body.id === "string" ? body.id : null
      if (!id) {
        return createErrorResponse("Product family id is required", 400)
      }

      try {
        const existing = await prisma.productFamily.findFirst({
          where: { id, tenantId },
          include: {
            _count: {
              select: {
                subtypes: true
              }
            }
          }
        })

        if (!existing) {
          return createErrorResponse("Product family not found", 404)
        }

        if (existing.isSystem) {
          return createErrorResponse(
            "System product families cannot be deleted",
            400
          )
        }

        if ((existing._count?.subtypes ?? 0) > 0) {
          return createErrorResponse(
            "Cannot delete a product family that still has product subtypes. Remove or reassign those subtypes first.",
            400
          )
        }

        await prisma.productFamily.delete({
          where: { id: existing.id }
        })

        return NextResponse.json({ success: true })
      } catch (error) {
        console.error("Failed to delete product family", error)
        return createErrorResponse("Failed to delete product family type", 500)
      }
    }
  )
}
