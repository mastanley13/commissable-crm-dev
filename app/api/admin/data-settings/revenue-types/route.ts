import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { withPermissions, createErrorResponse } from "@/lib/api-auth"
import { REVENUE_TYPE_DEFINITIONS } from "@/lib/revenue-types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MANAGE_PERMISSIONS = ["admin.data_settings.manage"]
const ENABLED_CODES_SETTING_KEY = "revenueTypes.enabledCodes"
const CUSTOM_DEFINITIONS_SETTING_KEY = "revenueTypes.customDefinitions"

const CANONICAL_REVENUE_CODES: string[] = REVENUE_TYPE_DEFINITIONS.map(
  def => def.code
)

type RevenueCategory = "NRC" | "MRC"

interface CustomRevenueTypeDefinition {
  code: string
  label: string
  description: string
  category: RevenueCategory
}

interface ApiRevenueTypeDefinition extends CustomRevenueTypeDefinition {
  isEnabled: boolean
}

function normalizeCode(value: string): string {
  return value
    .trim()
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase()
}

async function getCustomDefinitionsForTenant(
  tenantId: string
): Promise<CustomRevenueTypeDefinition[]> {
  const setting = await prisma.systemSetting.findUnique({
    where: {
      tenantId_key: {
        tenantId,
        key: CUSTOM_DEFINITIONS_SETTING_KEY
      }
    }
  })

  if (!setting?.value) {
    return []
  }

  const raw = setting.value as any
  let parsed: unknown

  if (Array.isArray(raw)) {
    parsed = raw
  } else if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw)
    } catch {
      return []
    }
  } else {
    return []
  }

  const canonicalCodes = new Set<string>(CANONICAL_REVENUE_CODES)
  const result: CustomRevenueTypeDefinition[] = []
  const seenCodes = new Set<string>()

  if (Array.isArray(parsed)) {
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue

      const value = item as any
      const code =
        typeof value.code === "string" ? value.code.trim() : ""
      const label =
        typeof value.label === "string" ? value.label.trim() : ""
      const description =
        typeof value.description === "string"
          ? value.description.trim()
          : ""
      const category =
        value.category === "NRC" || value.category === "MRC"
          ? value.category
          : null

      if (!code || !label || !category) continue
      if (canonicalCodes.has(code)) continue
      if (seenCodes.has(code)) continue

      seenCodes.add(code)
      result.push({
        code,
        label,
        description,
        category
      })
    }
  }

  return result
}

async function getEnabledCodesForTenant(
  tenantId: string,
  fallbackCodes: string[]
): Promise<Set<string>> {
  const setting = await prisma.systemSetting.findUnique({
    where: {
      tenantId_key: {
        tenantId,
        key: ENABLED_CODES_SETTING_KEY
      }
    }
  })

  if (!setting?.value) {
    return new Set(fallbackCodes)
  }

  const raw = setting.value as any
  let parsed: unknown

  if (Array.isArray(raw)) {
    parsed = raw
  } else if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw)
    } catch {
      return new Set(fallbackCodes)
    }
  } else {
    return new Set(fallbackCodes)
  }

  const result = new Set<string>()

  if (Array.isArray(parsed)) {
    for (const value of parsed) {
      if (typeof value === "string" && value.trim().length > 0) {
        result.add(value.trim())
      }
    }
  }

  return result.size > 0 ? result : new Set(fallbackCodes)
}

async function buildRevenueTypeResponse(
  tenantId: string
): Promise<ApiRevenueTypeDefinition[]> {
  const customDefinitions = await getCustomDefinitionsForTenant(tenantId)

  const allCodes: string[] = [
    ...CANONICAL_REVENUE_CODES,
    ...customDefinitions.map(def => def.code)
  ]

  const enabledCodes = await getEnabledCodesForTenant(tenantId, allCodes)

  const canonicalData: ApiRevenueTypeDefinition[] =
    REVENUE_TYPE_DEFINITIONS.map(def => ({
      code: def.code,
      label: def.label,
      description: def.description,
      category: def.category,
      isEnabled: enabledCodes.has(def.code)
    }))

  const customData: ApiRevenueTypeDefinition[] = customDefinitions.map(def => ({
    ...def,
    isEnabled: enabledCodes.has(def.code)
  }))

  return [...canonicalData, ...customData]
}

export async function GET(request: NextRequest) {
  return withPermissions(
    request,
    MANAGE_PERMISSIONS,
    async (req) => {
      const tenantId = req.user.tenantId

      try {
        const data = await buildRevenueTypeResponse(tenantId)
        return NextResponse.json({ data })
      } catch (error) {
        console.error("Failed to load revenue types", error)
        return createErrorResponse("Failed to load revenue types", 500)
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

      const label =
        typeof body.label === "string" ? body.label.trim() : ""
      const rawCategory = body.category
      const description =
        typeof body.description === "string" && body.description.trim().length > 0
          ? body.description.trim()
          : ""

      const category: RevenueCategory | null =
        rawCategory === "NRC" || rawCategory === "MRC"
          ? rawCategory
          : null

      if (!label) {
        return createErrorResponse("Label is required", 400)
      }

      if (!category) {
        return createErrorResponse("Category must be NRC or MRC", 400)
      }

      try {
        const existingCustom = await getCustomDefinitionsForTenant(tenantId)

        const existingCodes = new Set<string>([
          ...CANONICAL_REVENUE_CODES,
          ...existingCustom.map(def => def.code)
        ])

        const baseCode = normalizeCode(label)
        const prefix = `${category}_`
        let candidate = `${prefix}${baseCode}`
        if (!baseCode) {
          candidate = `${category}_CUSTOM`
        }

        let code = candidate
        let suffix = 2
        while (existingCodes.has(code)) {
          code = `${candidate}_${suffix}`
          suffix += 1
        }

        const updatedCustom: CustomRevenueTypeDefinition[] = [
          ...existingCustom,
          {
            code,
            label,
            description,
            category
          }
        ]

        const allCodes = [
          ...CANONICAL_REVENUE_CODES,
          ...updatedCustom.map(def => def.code)
        ]

        const enabledCodes = await getEnabledCodesForTenant(
          tenantId,
          allCodes
        )
        enabledCodes.add(code)

        await prisma.systemSetting.upsert({
          where: {
            tenantId_key: {
              tenantId,
              key: CUSTOM_DEFINITIONS_SETTING_KEY
            }
          },
          create: {
            tenantId,
            key: CUSTOM_DEFINITIONS_SETTING_KEY,
            value: JSON.stringify(updatedCustom),
            description:
              "Tenant-specific custom revenue type definitions."
          },
          update: {
            value: JSON.stringify(updatedCustom)
          }
        })

        await prisma.systemSetting.upsert({
          where: {
            tenantId_key: {
              tenantId,
              key: ENABLED_CODES_SETTING_KEY
            }
          },
          create: {
            tenantId,
            key: ENABLED_CODES_SETTING_KEY,
            value: JSON.stringify(Array.from(enabledCodes)),
            description:
              "List of revenue type codes that are enabled for selection."
          },
          update: {
            value: JSON.stringify(Array.from(enabledCodes))
          }
        })

        const created: ApiRevenueTypeDefinition = {
          code,
          label,
          description,
          category,
          isEnabled: true
        }

        return NextResponse.json({ data: created }, { status: 201 })
      } catch (error) {
        console.error("Failed to create revenue type", error)
        return createErrorResponse("Failed to create revenue type", 500)
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

      const codesFromInput = new Set<string>()

      for (const value of enabledCodesInput) {
        if (typeof value === "string" && value.trim().length > 0) {
          codesFromInput.add(value.trim())
        }
      }

      try {
        const customDefinitions = await getCustomDefinitionsForTenant(tenantId)

        const allCodes: string[] = [
          ...CANONICAL_REVENUE_CODES,
          ...customDefinitions.map(def => def.code)
        ]

        const codesToPersist: string[] =
          codesFromInput.size > 0 ? Array.from(codesFromInput) : allCodes

        await prisma.systemSetting.upsert({
          where: {
            tenantId_key: {
              tenantId,
              key: ENABLED_CODES_SETTING_KEY
            }
          },
          create: {
            tenantId,
            key: ENABLED_CODES_SETTING_KEY,
            value: JSON.stringify(codesToPersist),
            description:
              "List of revenue type codes that are enabled for selection."
          },
          update: {
            value: JSON.stringify(codesToPersist)
          }
        })

        const data = await buildRevenueTypeResponse(tenantId)

        return NextResponse.json({ data })
      } catch (error) {
        console.error("Failed to update revenue types setting", error)
        return createErrorResponse("Failed to update revenue types", 500)
      }
    }
  )
}
