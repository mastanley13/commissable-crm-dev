import { NextRequest, NextResponse } from "next/server"
import { AccountStatus } from "@prisma/client"
import { prisma } from "@/lib/db"
import { resolveTenantId } from "@/lib/server-utils"
import { getEnabledRevenueTypeOptions } from "@/lib/server-revenue-types"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const tenantId = await resolveTenantId(searchParams.get("tenantId"))

    const revenueTypes = await getEnabledRevenueTypeOptions(tenantId)

    const accounts = await prisma.account.findMany({
      where: {
        tenantId,
        status: AccountStatus.Active,
        accountType: {
          is: {
            OR: [
              { code: { equals: "DISTRIBUTOR", mode: "insensitive" } },
              { code: { equals: "VENDOR", mode: "insensitive" } }
            ],
          },
        },
      },
      orderBy: { accountName: "asc" },
      select: {
        id: true,
        accountName: true,
        accountType: { select: { name: true, code: true } }
      },
    })

    const toOption = (a: typeof accounts[number]) => ({ value: a.id, label: a.accountName })
    const distributorAccounts = accounts
      .filter((a) => (a.accountType?.code ?? "").toUpperCase() === "DISTRIBUTOR")
      .map(toOption)
    const vendorAccounts = accounts
      .filter((a) => (a.accountType?.code ?? "").toUpperCase() === "VENDOR")
      .map(toOption)

    return NextResponse.json({
      distributorAccounts,
      vendorAccounts,
      accounts: [...distributorAccounts, ...vendorAccounts],
      revenueTypes
    })
  } catch (error) {
    console.error("Failed to load product options", error)
    return NextResponse.json({ error: "Failed to load product options" }, { status: 500 })
  }
}




























