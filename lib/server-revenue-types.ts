"use server"

import { prisma } from "@/lib/db"
import { REVENUE_TYPE_DEFINITIONS } from "@/lib/revenue-types"

const ENABLED_CODES_SETTING_KEY = "revenueTypes.enabledCodes"
const DEFINITIONS_SETTING_KEY = "revenueTypes.customDefinitions"

type RevenueCategory = "NRC" | "MRC"

interface RevenueTypeDefinitionRecord {
  code: string
  label: string
  description: string
  category: RevenueCategory
}

export type RevenueTypeOption = { value: string; label: string }

const DEFAULT_REVENUE_TYPE_DEFINITIONS: RevenueTypeDefinitionRecord[] =
  REVENUE_TYPE_DEFINITIONS.map(def => ({
    code: def.code,
    label: def.label,
    description: def.description,
    category: def.category
  }))

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
    results.push({ code, label, description, category })
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
  const validCodes = new Set(definitions.map(def => def.code))
  const normalizedEnabled = Array.from(new Set(enabledCodes)).filter(code =>
    validCodes.has(code)
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

async function getRevenueTypeSettings(tenantId: string): Promise<{
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

export async function getAllRevenueTypeOptions(
  tenantId: string
): Promise<RevenueTypeOption[]> {
  const { definitions } = await getRevenueTypeSettings(tenantId)
  return definitions.map(def => ({ value: def.code, label: def.label }))
}

export async function getEnabledRevenueTypeOptions(
  tenantId: string
): Promise<RevenueTypeOption[]> {
  const { definitions, enabledCodes } = await getRevenueTypeSettings(tenantId)
  return definitions
    .filter(def => enabledCodes.has(def.code))
    .map(def => ({ value: def.code, label: def.label }))
}

export async function isEnabledRevenueType(
  tenantId: string,
  code: string
): Promise<boolean> {
  const { enabledCodes } = await getRevenueTypeSettings(tenantId)
  return enabledCodes.has(code)
}
