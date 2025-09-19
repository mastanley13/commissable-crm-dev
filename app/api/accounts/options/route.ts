import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { resolveTenantId } from "@/lib/server-utils"

export async function GET(request: NextRequest) {
  try {
    const tenantId = await resolveTenantId(request.nextUrl.searchParams.get("tenantId"))

    const [accountTypes, industries, parentAccounts, owners] = await Promise.all([
      prisma.accountType.findMany({
        where: { tenantId },
        orderBy: { displayOrder: "asc" },
        select: { id: true, name: true }
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
        where: { tenantId },
        orderBy: { fullName: "asc" },
        select: { id: true, fullName: true }
      })
    ])

    return NextResponse.json({
      accountTypes,
      industries,
      parentAccounts,
      owners
    })
  } catch (error) {
    console.error("Failed to load account options", error)
    return NextResponse.json({ error: "Failed to load account options" }, { status: 500 })
  }
}
