import { NextRequest, NextResponse } from "next/server"
import { AccountStatus } from "@prisma/client"
import { prisma } from "@/lib/db"
import { resolveTenantId } from "@/lib/server-utils"
import {
  REVENUE_TYPE_DEFINITIONS,
  isRevenueTypeCode,
  type RevenueTypeCode
} from "@/lib/revenue-types"
import { ensureNoneDirectDistributorAccount } from "@/lib/none-direct-distributor"

export const dynamic = "force-dynamic"

const REVENUE_TYPES_SETTING_KEY = "revenueTypes.enabledCodes"

const ALL_REVENUE_CODES: RevenueTypeCode[] = REVENUE_TYPE_DEFINITIONS.map(
  (def) => def.code
)

async function getEnabledRevenueTypeOptions(tenantId: string) {
  const setting = await prisma.systemSetting.findUnique({
    where: {
      tenantId_key: {
        tenantId,
        key: REVENUE_TYPES_SETTING_KEY
      }
    }
  })

  if (!setting?.value) {
    return REVENUE_TYPE_DEFINITIONS.map((def) => ({
      value: def.code,
      label: def.label
    }))
  }

  const raw = setting.value as any
  let parsed: unknown

  if (Array.isArray(raw)) {
    parsed = raw
  } else if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = null
    }
  } else {
    parsed = null
  }

  const enabled = new Set<RevenueTypeCode>()

  if (Array.isArray(parsed)) {
    for (const value of parsed) {
      if (isRevenueTypeCode(value)) {
        enabled.add(value)
      }
    }
  }

  const finalCodes = enabled.size > 0 ? enabled : new Set(ALL_REVENUE_CODES)

  return REVENUE_TYPE_DEFINITIONS.filter((def) => finalCodes.has(def.code)).map(
    (def) => ({
      value: def.code,
      label: def.label
    })
  )
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const tenantId = await resolveTenantId(searchParams.get("tenantId"))

    await ensureNoneDirectDistributorAccount(tenantId)
    const revenueTypes = await getEnabledRevenueTypeOptions(tenantId)

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
      revenueTypes
    })
  } catch (error) {
    console.error("Failed to load product options", error)
    return NextResponse.json({ error: "Failed to load product options" }, { status: 500 })
  }
}





























