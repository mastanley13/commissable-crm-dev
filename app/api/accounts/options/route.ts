import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { resolveTenantId } from "@/lib/server-utils"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const tenantId = await resolveTenantId(request.nextUrl.searchParams.get("tenantId"))

    const [accountTypes, industries, parentAccounts, owners, defaultHouseOwner] = await Promise.all([
      prisma.accountType.findMany({
        where: { tenantId, isActive: true },
        orderBy: { displayOrder: "asc" },
        select: { id: true, name: true, code: true }
      }),
      prisma.industry.findMany({
        where: { tenantId },
        orderBy: { name: "asc" },
        select: { id: true, name: true }
      }),
      prisma.account.findMany({
        where: { tenantId },
        orderBy: { accountName: "asc" },
        select: { id: true, accountName: true }
      }),
      prisma.user.findMany({
        where: { tenantId, status: "Active" },
        orderBy: { fullName: "asc" },
        select: { id: true, fullName: true }
      }),
      prisma.user.findFirst({
        where: {
          tenantId,
          status: "Active",
          role: { is: { code: "ADMIN" } }
        },
        orderBy: { createdAt: "asc" },
        select: { id: true }
      })
    ])

    return NextResponse.json({
      accountTypes,
      industries,
      parentAccounts,
      owners,
      defaultHouseOwnerId: defaultHouseOwner?.id ?? null
    })
  } catch (error) {
    console.error("Failed to load account options", error)
    return NextResponse.json({ error: "Failed to load account options" }, { status: 500 })
  }
}
