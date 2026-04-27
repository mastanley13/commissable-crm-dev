import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { withPermissions, createErrorResponse } from "@/lib/api-auth"
import { REVENUE_TYPE_DEFINITIONS } from "@/lib/revenue-types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MANAGE_PERMISSIONS = ["admin.data_settings.manage"]
const ENABLED_CODES_SETTING_KEY = "revenueTypes.enabledCodes"
const DEFINITIONS_SETTING_KEY = "revenueTypes.customDefinitions"

type RevenueCategory = "NRC" | "MRC"

interface RevenueTypeDefinitionRecord {
  code: string
  label: string
  description: string
  category: RevenueCategory
}

interface ApiRevenueTypeDefinition extends RevenueTypeDefinitionRecord {
  isEnabled: boolean
  isSystem: boolean
  usageCount: number
}

const DEFAULT_REVENUE_TYPE_DEFINITIONS: RevenueTypeDefinitionRecord[] =
  REVENUE_TYPE_DEFINITIONS.map(def => ({
    code: def.code,
    label: def.label,
    description: def.description,
    category: def.category
  }))

function normalizeCode(value: string): string {
  return value
    .trim()
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase()
}

function parseSettingArray(value: unknown): unknown[] {
  if (!value) return []
  if (Array.isArray(value)) return value
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

function normalizeDefinitions(value: unknown): RevenueTypeDefinitionRecord[] {
  const parsed = parseSettingArray(value)
  const results: RevenueTypeDefinitionRecord[] = []
  const seenCodes = new Set<string>()

  for (const item of parsed) {
    if (!item || typeof item !== "object") continue
    const candidate = item as Record<string, unknown>
    const code = typeof candidate.code === "string" ? candidate.code.trim() : ""
    const label = typeof candidate.label === "string" ? candidate.label.trim() : ""
    const description =
      typeof candidate.description === "string" ? candidate.description.trim() : ""
    const category =
      candidate.category === "NRC" || candidate.category === "MRC"
        ? candidate.category
        : null

    if (!code || !label || !category || seenCodes.has(code)) {
      continue
    }

    seenCodes.add(code)
    results.push({
      code,
      label,
      description,
      category
    })
  }

  return results
}

function normalizeEnabledCodes(
  value: unknown,
  validCodes: Set<string>
): Set<string> {
  const parsed = parseSettingArray(value)
  const results = new Set<string>()

  for (const item of parsed) {
    if (typeof item !== "string") continue
    const code = item.trim()
    if (!code || !validCodes.has(code)) continue
    results.add(code)
  }

  return results
}

async function persistDefinitionsAndEnabledCodes(
  tenantId: string,
  definitions: RevenueTypeDefinitionRecord[],
  enabledCodes: Iterable<string>
) {
  const codes = new Set(definitions.map(def => def.code))
  const normalizedEnabled = Array.from(new Set(enabledCodes)).filter(code =>
    codes.has(code)
  )

  await Promise.all([
    prisma.systemSetting.upsert({
      where: {
        tenantId_key: {
          tenantId,
          key: DEFINITIONS_SETTING_KEY
        }
      },
      create: {
        tenantId,
        key: DEFINITIONS_SETTING_KEY,
        value: JSON.stringify(definitions),
        description: "Tenant-managed revenue type definitions."
      },
      update: {
        value: JSON.stringify(definitions)
      }
    }),
    prisma.systemSetting.upsert({
      where: {
        tenantId_key: {
          tenantId,
          key: ENABLED_CODES_SETTING_KEY
        }
      },
      create: {
        tenantId,
        key: ENABLED_CODES_SETTING_KEY,
        value: JSON.stringify(normalizedEnabled),
        description: "List of revenue type codes that are enabled for selection."
      },
      update: {
        value: JSON.stringify(normalizedEnabled)
      }
    })
  ])
}

async function getRevenueTypeSettings(
  tenantId: string
): Promise<{
  definitions: RevenueTypeDefinitionRecord[]
  enabledCodes: Set<string>
}> {
  const [definitionsSetting, enabledSetting] = await Promise.all([
    prisma.systemSetting.findUnique({
      where: {
        tenantId_key: {
          tenantId,
          key: DEFINITIONS_SETTING_KEY
        }
      }
    }),
    prisma.systemSetting.findUnique({
      where: {
        tenantId_key: {
          tenantId,
          key: ENABLED_CODES_SETTING_KEY
        }
      }
    })
  ])

  let definitions = normalizeDefinitions(definitionsSetting?.value)
  const shouldBootstrapDefinitions = definitions.length === 0 && !definitionsSetting

  if (shouldBootstrapDefinitions) {
    definitions = DEFAULT_REVENUE_TYPE_DEFINITIONS
  }

  const validCodes = new Set(definitions.map(def => def.code))
  let enabledCodes = normalizeEnabledCodes(enabledSetting?.value, validCodes)

  const shouldBootstrapEnabled = !enabledSetting && definitions.length > 0
  if (shouldBootstrapEnabled) {
    enabledCodes = new Set(definitions.map(def => def.code))
  }

  if (shouldBootstrapDefinitions || shouldBootstrapEnabled) {
    await persistDefinitionsAndEnabledCodes(tenantId, definitions, enabledCodes)
  }

  return { definitions, enabledCodes }
}

async function buildRevenueTypeResponse(
  tenantId: string
): Promise<ApiRevenueTypeDefinition[]> {
  const { definitions, enabledCodes } = await getRevenueTypeSettings(tenantId)

  if (definitions.length === 0) {
    return []
  }

  const usageRows = await prisma.product.groupBy({
    by: ["revenueType"],
    where: {
      tenantId,
      revenueType: { in: definitions.map(def => def.code) }
    },
    _count: { _all: true }
  })

  const usageByCode = new Map<string, number>(
    usageRows.map(row => [row.revenueType, row._count._all] as const)
  )

  return definitions.map(def => ({
    ...def,
    isEnabled: enabledCodes.has(def.code),
    isSystem: false,
    usageCount: usageByCode.get(def.code) ?? 0
  }))
}

export async function GET(request: NextRequest) {
  return withPermissions(request, MANAGE_PERMISSIONS, async req => {
    const tenantId = req.user.tenantId

    try {
      const data = await buildRevenueTypeResponse(tenantId)
      return NextResponse.json({ data })
    } catch (error) {
      console.error("Failed to load revenue types", error)
      return createErrorResponse("Failed to load revenue types", 500)
    }
  })
}

export async function POST(request: NextRequest) {
  return withPermissions(request, MANAGE_PERMISSIONS, async req => {
    const tenantId = req.user.tenantId
    const body = await request.json()

    const label = typeof body.label === "string" ? body.label.trim() : ""
    const description =
      typeof body.description === "string" ? body.description.trim() : ""
    const category: RevenueCategory | null =
      body.category === "NRC" || body.category === "MRC" ? body.category : null

    if (!label) {
      return createErrorResponse("Label is required", 400)
    }

    if (!category) {
      return createErrorResponse("Category must be NRC or MRC", 400)
    }

    try {
      const { definitions, enabledCodes } = await getRevenueTypeSettings(tenantId)
      const existingCodes = new Set(definitions.map(def => def.code))

      const baseCode = normalizeCode(label)
      const prefix = `${category}_`
      const baseCandidate = baseCode ? `${prefix}${baseCode}` : `${category}_CUSTOM`

      let code = baseCandidate
      let suffix = 2
      while (existingCodes.has(code)) {
        code = `${baseCandidate}_${suffix}`
        suffix += 1
      }

      const created: RevenueTypeDefinitionRecord = {
        code,
        label,
        description,
        category
      }

      const nextDefinitions = [...definitions, created]
      const nextEnabledCodes = new Set(enabledCodes)
      nextEnabledCodes.add(code)

      await persistDefinitionsAndEnabledCodes(
        tenantId,
        nextDefinitions,
        nextEnabledCodes
      )

      return NextResponse.json(
        {
          data: {
            ...created,
            isEnabled: true,
            isSystem: false,
            usageCount: 0
          }
        },
        { status: 201 }
      )
    } catch (error) {
      console.error("Failed to create revenue type", error)
      return createErrorResponse("Failed to create revenue type", 500)
    }
  })
}

export async function PATCH(request: NextRequest) {
  return withPermissions(request, MANAGE_PERMISSIONS, async req => {
    const tenantId = req.user.tenantId
    const body = await request.json()
    const enabledCodesInput: unknown = body.enabledCodes

    if (!Array.isArray(enabledCodesInput)) {
      return createErrorResponse("enabledCodes must be an array", 400)
    }

    try {
      const { definitions } = await getRevenueTypeSettings(tenantId)
      const validCodes = new Set(definitions.map(def => def.code))
      const nextEnabledCodes = new Set<string>()

      for (const value of enabledCodesInput) {
        if (typeof value !== "string") continue
        const code = value.trim()
        if (!code || !validCodes.has(code)) continue
        nextEnabledCodes.add(code)
      }

      await persistDefinitionsAndEnabledCodes(
        tenantId,
        definitions,
        nextEnabledCodes
      )

      const data = await buildRevenueTypeResponse(tenantId)
      return NextResponse.json({ data })
    } catch (error) {
      console.error("Failed to update revenue types setting", error)
      return createErrorResponse("Failed to update revenue types", 500)
    }
  })
}

export async function PUT(request: NextRequest) {
  return withPermissions(request, MANAGE_PERMISSIONS, async req => {
    const tenantId = req.user.tenantId
    const body = await request.json()

    const code = typeof body.code === "string" ? body.code.trim() : ""
    const label = typeof body.label === "string" ? body.label.trim() : ""
    const description =
      typeof body.description === "string" ? body.description.trim() : ""

    if (!code) {
      return createErrorResponse("Revenue type code is required", 400)
    }

    if (!label) {
      return createErrorResponse("Label is required", 400)
    }

    try {
      const { definitions, enabledCodes } = await getRevenueTypeSettings(tenantId)
      const index = definitions.findIndex(def => def.code === code)

      if (index === -1) {
        return createErrorResponse("Revenue type not found", 404)
      }

      const nextDefinitions = [...definitions]
      nextDefinitions[index] = {
        ...nextDefinitions[index],
        label,
        description
      }

      await persistDefinitionsAndEnabledCodes(
        tenantId,
        nextDefinitions,
        enabledCodes
      )

      const usageCount = await prisma.product.count({
        where: {
          tenantId,
          revenueType: code
        }
      })

      return NextResponse.json({
        data: {
          ...nextDefinitions[index],
          isEnabled: enabledCodes.has(code),
          isSystem: false,
          usageCount
        }
      })
    } catch (error) {
      console.error("Failed to update revenue type", error)
      return createErrorResponse("Failed to update revenue type", 500)
    }
  })
}

export async function DELETE(request: NextRequest) {
  return withPermissions(request, MANAGE_PERMISSIONS, async req => {
    const tenantId = req.user.tenantId

    let body: Record<string, unknown> | null = null
    try {
      body = await request.json()
    } catch {
      body = null
    }

    const code = body && typeof body.code === "string" ? body.code.trim() : ""

    if (!code) {
      return createErrorResponse("Revenue type code is required", 400)
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

      const { definitions, enabledCodes } = await getRevenueTypeSettings(tenantId)
      const nextDefinitions = definitions.filter(def => def.code !== code)

      if (nextDefinitions.length === definitions.length) {
        return createErrorResponse("Revenue type not found", 404)
      }

      const nextEnabledCodes = new Set(enabledCodes)
      nextEnabledCodes.delete(code)

      await persistDefinitionsAndEnabledCodes(
        tenantId,
        nextDefinitions,
        nextEnabledCodes
      )

      return NextResponse.json({ success: true })
    } catch (error) {
      console.error("Failed to delete revenue type", error)
      return createErrorResponse("Failed to delete revenue type", 500)
    }
  })
}
