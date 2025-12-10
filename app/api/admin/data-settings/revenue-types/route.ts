import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { withPermissions, createErrorResponse } from "@/lib/api-auth"
import {
  REVENUE_TYPE_DEFINITIONS,
  isRevenueTypeCode,
  type RevenueTypeCode
} from "@/lib/revenue-types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MANAGE_PERMISSIONS = ["admin.data_settings.manage"]
const SETTING_KEY = "revenueTypes.enabledCodes"

const ALL_REVENUE_CODES: RevenueTypeCode[] = REVENUE_TYPE_DEFINITIONS.map(
  def => def.code
)

async function getEnabledCodesForTenant(
  tenantId: string
): Promise<Set<RevenueTypeCode>> {
  const setting = await prisma.systemSetting.findUnique({
    where: {
      tenantId_key: {
        tenantId,
        key: SETTING_KEY
      }
    }
  })

  if (!setting?.value) {
    return new Set(ALL_REVENUE_CODES)
  }

  const raw = setting.value as any
  let parsed: unknown

  if (Array.isArray(raw)) {
    parsed = raw
  } else if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw)
    } catch {
      return new Set(ALL_REVENUE_CODES)
    }
  } else {
    return new Set(ALL_REVENUE_CODES)
  }

  const result = new Set<RevenueTypeCode>()

  if (Array.isArray(parsed)) {
    for (const value of parsed) {
      if (isRevenueTypeCode(value)) {
        result.add(value)
      }
    }
  }

  return result.size > 0 ? result : new Set(ALL_REVENUE_CODES)
}

export async function GET(request: NextRequest) {
  return withPermissions(
    request,
    MANAGE_PERMISSIONS,
    async (req) => {
      const tenantId = req.user.tenantId

      try {
        const enabledCodes = await getEnabledCodesForTenant(tenantId)

        const data = REVENUE_TYPE_DEFINITIONS.map(def => ({
          ...def,
          isEnabled: enabledCodes.has(def.code)
        }))

        return NextResponse.json({ data })
      } catch (error) {
        console.error("Failed to load revenue types", error)
        return createErrorResponse("Failed to load revenue types", 500)
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

      const enabledCodesInput: unknown = body.enabledCodes

      if (!Array.isArray(enabledCodesInput)) {
        return createErrorResponse("enabledCodes must be an array", 400)
      }

      const nextCodes: RevenueTypeCode[] = []
      for (const value of enabledCodesInput) {
        if (isRevenueTypeCode(value)) {
          nextCodes.push(value)
        }
      }

      const codesToPersist =
        nextCodes.length > 0 ? nextCodes : ALL_REVENUE_CODES

      try {
        await prisma.systemSetting.upsert({
          where: {
            tenantId_key: {
              tenantId,
              key: SETTING_KEY
            }
          },
          create: {
            tenantId,
            key: SETTING_KEY,
            value: JSON.stringify(codesToPersist),
            description:
              "List of revenue type codes that are enabled for selection."
          },
          update: {
            value: JSON.stringify(codesToPersist)
          }
        })

        const enabledSet = new Set<RevenueTypeCode>(codesToPersist)

        const data = REVENUE_TYPE_DEFINITIONS.map(def => ({
          ...def,
          isEnabled: enabledSet.has(def.code)
        }))

        return NextResponse.json({ data })
      } catch (error) {
        console.error("Failed to update revenue types setting", error)
        return createErrorResponse("Failed to update revenue types", 500)
      }
    }
  )
}

