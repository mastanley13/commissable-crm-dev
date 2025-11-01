import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { resolveTenantId } from "@/lib/server-utils"
import { RevenueType } from "@prisma/client"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const tenantId = await resolveTenantId(searchParams.get("tenantId"))

    const [accounts] = await Promise.all([
      prisma.account.findMany({
        where: { tenantId },
        orderBy: { accountName: "asc" },
        select: { id: true, accountName: true },
      }),
    ])

    return NextResponse.json({
      accounts: accounts.map((a) => ({ value: a.id, label: a.accountName })),
      revenueTypes: (Object.values(RevenueType) as string[]).map((rt) => ({ value: rt, label: rt })),
    })
  } catch (error) {
    console.error("Failed to load product options", error)
    return NextResponse.json({ error: "Failed to load product options" }, { status: 500 })
  }
}











