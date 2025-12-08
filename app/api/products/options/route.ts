import { NextRequest, NextResponse } from "next/server"
import { AccountStatus } from "@prisma/client"
import { prisma } from "@/lib/db"
import { resolveTenantId } from "@/lib/server-utils"
import { REVENUE_TYPE_OPTIONS } from "@/lib/revenue-types"
import { ensureNoneDirectDistributorAccount } from "@/lib/none-direct-distributor"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const tenantId = await resolveTenantId(searchParams.get("tenantId"))

    await ensureNoneDirectDistributorAccount(tenantId)

    const accounts = await prisma.account.findMany({
      where: {
        tenantId,
        status: AccountStatus.Active,
        accountType: {
          is: {
            OR: [
              { name: { equals: "Distributor", mode: "insensitive" } },
              { name: { equals: "Vendor", mode: "insensitive" } },
            ],
          },
        },
      },
      orderBy: { accountName: "asc" },
      select: { id: true, accountName: true, accountType: { select: { name: true } } },
    })

    const toOption = (a: typeof accounts[number]) => ({ value: a.id, label: a.accountName })
    const distributorAccounts = accounts
      .filter((a) => (a.accountType?.name ?? "").toLowerCase() === "distributor")
      .map(toOption)
    const vendorAccounts = accounts
      .filter((a) => (a.accountType?.name ?? "").toLowerCase() === "vendor")
      .map(toOption)

    return NextResponse.json({
      distributorAccounts,
      vendorAccounts,
      accounts: [...distributorAccounts, ...vendorAccounts],
      revenueTypes: REVENUE_TYPE_OPTIONS
    })
  } catch (error) {
    console.error("Failed to load product options", error)
    return NextResponse.json({ error: "Failed to load product options" }, { status: 500 })
  }
}





























