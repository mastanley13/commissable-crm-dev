import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { withPermissions } from "@/lib/api-auth"
import { isHouseAccountType } from "@/lib/account-type"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const PERMISSIONS = ["admin.data_settings.manage", "accounts.manage", "opportunities.manage"]

export async function GET(request: NextRequest) {
  return withPermissions(request, PERMISSIONS, async (req) => {
    try {
      const tenantId = req.user.tenantId

      const houseAccountTypes = await prisma.accountType.findMany({
        where: {
          tenantId,
          OR: [
            { name: { equals: "House", mode: "insensitive" } },
            { code: { equals: "HOUSE_REP", mode: "insensitive" } }
          ]
        },
        select: { id: true, code: true, name: true }
      })

      if (houseAccountTypes.length === 0) {
        return NextResponse.json({ data: { accounts: [] } })
      }

      const typeIds = houseAccountTypes.map(type => type.id)

      const accounts = await prisma.account.findMany({
        where: {
          tenantId,
          accountTypeId: { in: typeIds },
          opportunities: { some: {} }
        },
        select: {
          id: true,
          accountName: true,
          accountLegalName: true,
          accountType: { select: { code: true, name: true } },
          _count: { select: { opportunities: true } },
          opportunities: {
            select: { id: true, name: true, createdAt: true },
            orderBy: { createdAt: "desc" },
            take: 10
          }
        },
        orderBy: { updatedAt: "desc" },
        take: 500
      })

      const rows = accounts.map(account => ({
        id: account.id,
        accountName: account.accountName,
        accountLegalName: account.accountLegalName ?? "",
        accountType: account.accountType?.name ?? "",
        opportunityCount: account._count.opportunities,
        opportunities: account.opportunities,
        isHouse: isHouseAccountType(account.accountType)
      }))

      return NextResponse.json({ data: { accounts: rows } })
    } catch (error) {
      console.error("Failed to load House account opportunity violations", error)
      return NextResponse.json({ error: "Failed to load House account opportunity violations" }, { status: 500 })
    }
  })
}

