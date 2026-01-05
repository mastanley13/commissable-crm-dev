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
  isSystem: boolean
  usageCount: number
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

  const customByCode = new Map(
    customDefinitions.map(def => [def.code, def] as const)
  )

  const canonicalData: ApiRevenueTypeDefinition[] =
    REVENUE_TYPE_DEFINITIONS.map(def => {
      const override = customByCode.get(def.code)
      return {
        code: def.code,
        label: override?.label ?? def.label,
        description: override?.description ?? def.description,
        category: def.category,
        isEnabled: enabledCodes.has(def.code),
        isSystem: true,
        usageCount: 0
      }
    })

  const customData: ApiRevenueTypeDefinition[] = customDefinitions
    .filter(def => !CANONICAL_REVENUE_CODES.includes(def.code))
    .map(def => ({
      code: def.code,
      label: def.label,
      description: def.description,
      category: def.category,
      isEnabled: enabledCodes.has(def.code),
      isSystem: false,
      usageCount: 0
    }))

  const response = [...canonicalData, ...customData]

  if (response.length === 0) return response

  const usageRows = await prisma.product.groupBy({
    by: ["revenueType"],
    where: {
      tenantId,
      revenueType: { in: response.map(item => item.code) }
    },
    _count: { _all: true }
  })

  const usageByCode = new Map<string, number>(
    usageRows.map(row => [row.revenueType, row._count._all] as const)
  )

  return response.map(item => ({
    ...item,
    usageCount: usageByCode.get(item.code) ?? 0
  }))
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
          isEnabled: true,
          isSystem: false,
          usageCount: 0
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

export async function PUT(request: NextRequest) {
  return withPermissions(
    request,
    MANAGE_PERMISSIONS,
    async (req) => {
      const tenantId = req.user.tenantId
      const body = await request.json()

      const code =
        typeof body.code === "string" ? body.code.trim() : ""

      if (!code) {
        return createErrorResponse("Revenue type code is required", 400)
      }

      const label =
        typeof body.label === "string" ? body.label.trim() : ""
      const description =
        typeof body.description === "string"
          ? body.description.trim()
          : ""

      if (!label) {
        return createErrorResponse("Label is required", 400)
      }


      try {
        const canonical = REVENUE_TYPE_DEFINITIONS.find(
          def => def.code === code
        )
        const existingCustom = await getCustomDefinitionsForTenant(tenantId)

        let updatedCustom: CustomRevenueTypeDefinition[]

        if (canonical) {
          // Treat as an override for a canonical revenue type
          const withoutThis = existingCustom.filter(def => def.code !== code)
          updatedCustom = [
            ...withoutThis,
            {
              code,
              label,
              description,
              category: canonical.category
            }
          ]
        } else {
          const index = existingCustom.findIndex(def => def.code === code)
          if (index === -1) {
            return createErrorResponse("Custom revenue type not found", 404)
          }

          updatedCustom = [...existingCustom]
          updatedCustom[index] = {
            ...updatedCustom[index],
            label,
            description
          }
        }

        const allCodes: string[] = [
          ...CANONICAL_REVENUE_CODES,
          ...updatedCustom.map(def => def.code)
        ]

        const enabledCodes = await getEnabledCodesForTenant(
          tenantId,
          allCodes
        )

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

        const updatedDef =
          updatedCustom.find(def => def.code === code) ?? canonical!

        const usageCount = await prisma.product.count({
          where: {
            tenantId,
            revenueType: updatedDef.code
          }
        })

        const response: ApiRevenueTypeDefinition = {
          code: updatedDef.code,
          label: updatedDef.label,
          description: updatedDef.description,
          category: updatedDef.category,
          isEnabled: enabledCodes.has(updatedDef.code),
          isSystem: canonical ? true : false,
          usageCount
        }

        return NextResponse.json({ data: response })
      } catch (error) {
        console.error("Failed to update revenue type", error)
        return createErrorResponse("Failed to update revenue type", 500)
      }
    }
  )
}

export async function DELETE(request: NextRequest) {
  return withPermissions(
    request,
    MANAGE_PERMISSIONS,
    async (req) => {
      const tenantId = req.user.tenantId

      let body: any = null
      try {
        body = await request.json()
      } catch {
        // Ignore parse errors and handle as missing code below
      }

      const code =
        body && typeof body.code === "string" ? body.code.trim() : ""

      if (!code) {
        return createErrorResponse("Revenue type code is required", 400)
      }

      if (CANONICAL_REVENUE_CODES.includes(code)) {
        return createErrorResponse(
          "Canonical revenue types cannot be deleted. Disable them instead.",
          400
        )
      }

      try {
        const usageCount = await prisma.product.count({
          where: {
            tenantId,
            revenueType: code
          }
        })

        if (usageCount > 0) {
          return createErrorResponse(
            "Cannot delete a revenue type that is currently used by products.",
            400
          )
        }

        const existingCustom = await getCustomDefinitionsForTenant(tenantId)

        const index = existingCustom.findIndex(def => def.code === code)
        if (index === -1) {
          return createErrorResponse("Custom revenue type not found", 404)
        }

        const updatedCustom = existingCustom.filter(def => def.code !== code)

        const allCodes: string[] = [
          ...CANONICAL_REVENUE_CODES,
          ...updatedCustom.map(def => def.code)
        ]

        const enabledCodes = await getEnabledCodesForTenant(
          tenantId,
          allCodes
        )
        enabledCodes.delete(code)

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

        return NextResponse.json({ success: true })
      } catch (error) {
        console.error("Failed to delete revenue type", error)
        return createErrorResponse("Failed to delete revenue type", 500)
      }
    }
  )
}
