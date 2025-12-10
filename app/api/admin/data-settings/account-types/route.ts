import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { withPermissions, createErrorResponse } from "@/lib/api-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MANAGE_PERMISSIONS = ["admin.data_settings.manage"]

const CANONICAL_ACCOUNT_TYPE_CODES = new Set([
  "CUSTOMER",
  "DISTRIBUTOR",
  "HOUSE_REP",
  "OTHER",
  "PROSPECT",
  "SUBAGENT",
  "VENDOR"
])

function normalizeCode(value: string): string {
  return value
    .trim()
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase()
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
        const accountTypes = await prisma.accountType.findMany({
          where: {
            tenantId,
            ...(includeInactive ? {} : { isActive: true })
          },
          orderBy: { displayOrder: "asc" },
          include: {
            _count: {
              select: {
                accounts: true,
                contacts: true
              }
            }
          }
        })

        const data = accountTypes.map(type => ({
          id: type.id,
          code: type.code,
          name: type.name,
          description: type.description,
          isAssignableToContacts: type.isAssignableToContacts,
          isActive: type.isActive,
          isSystem: type.isSystem,
          displayOrder: type.displayOrder,
          usageCount: (type._count?.accounts ?? 0) + (type._count?.contacts ?? 0)
        }))

        return NextResponse.json({ data })
      } catch (error) {
        console.error("Failed to load account types", error)
        return createErrorResponse("Failed to load account types", 500)
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
      const isAssignableToContacts =
        typeof body.isAssignableToContacts === "boolean"
          ? body.isAssignableToContacts
          : true
      const isActive =
        typeof body.isActive === "boolean" ? body.isActive : true
      const displayOrder =
        typeof body.displayOrder === "number" ? body.displayOrder : 1000

      if (!name) {
        return createErrorResponse("Name is required", 400)
      }

      const code = normalizeCode(rawCode || name)

      try {
        const accountType = await prisma.accountType.create({
          data: {
            tenantId,
            name,
            code,
            description,
            isAssignableToContacts,
            isActive,
            isSystem: false,
            displayOrder
          }
        })

        return NextResponse.json({ data: accountType }, { status: 201 })
      } catch (error) {
        console.error("Failed to create account type", error)
        return createErrorResponse("Failed to create account type", 500)
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
        return createErrorResponse("Account type id is required", 400)
      }

      try {
        const existing = await prisma.accountType.findFirst({
          where: { id, tenantId }
        })

        if (!existing) {
          return createErrorResponse("Account type not found", 404)
        }

        const isCanonical = CANONICAL_ACCOUNT_TYPE_CODES.has(
          existing.code.toUpperCase()
        )

        const data: any = {}

        if (!isCanonical && typeof body.name === "string") {
          const name = body.name.trim()
          if (name && name !== existing.name) {
            data.name = name
          }
        }

        if (typeof body.description === "string") {
          const description = body.description.trim()
          data.description = description.length > 0 ? description : null
        }

        if (typeof body.isAssignableToContacts === "boolean") {
          data.isAssignableToContacts = body.isAssignableToContacts
        }

        if (typeof body.isActive === "boolean") {
          data.isActive = body.isActive
        }

        if (typeof body.displayOrder === "number") {
          data.displayOrder = body.displayOrder
        }

        // Do not allow changing code or isSystem via this endpoint

        if (Object.keys(data).length === 0) {
          return NextResponse.json({ data: existing })
        }

        const updated = await prisma.accountType.update({
          where: { id: existing.id },
          data
        })

        return NextResponse.json({ data: updated })
      } catch (error) {
        console.error("Failed to update account type", error)
        return createErrorResponse("Failed to update account type", 500)
      }
    }
  )
}

