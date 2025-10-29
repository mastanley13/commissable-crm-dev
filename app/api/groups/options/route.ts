import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { withPermissions } from "@/lib/api-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// GET /api/groups/options
// Returns a lightweight list of groups for selects
export async function GET(request: NextRequest) {
  return withPermissions(
    request,
    ["groups.manage", "groups.read", "accounts.manage", "accounts.read"],
    async (req) => {
      const { searchParams } = new URL(request.url)
      const search = searchParams.get("search") || ""
      const status = (searchParams.get("status") || "Active").toLowerCase()
      const limit = Math.min(parseInt(searchParams.get("limit") || "200", 10) || 200, 500)

      const where: any = {
        tenantId: req.user.tenantId
      }

      if (status === "active") {
        where.isActive = true
      } else if (status === "inactive") {
        where.isActive = false
      }

      if (search) {
        where.name = { contains: search, mode: "insensitive" }
      }

      const groups = await prisma.group.findMany({
        where,
        orderBy: { name: "asc" },
        take: limit,
        select: {
          id: true,
          name: true,
          isActive: true,
          groupType: true,
        }
      })

      return NextResponse.json({
        data: {
          groups: groups.map((g) => ({ value: g.id, label: g.name, isActive: g.isActive, groupType: g.groupType }))
        }
      })
    }
  )
}

