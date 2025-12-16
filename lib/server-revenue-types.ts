"use server"

import { prisma } from "@/lib/db"
import { REVENUE_TYPE_DEFINITIONS } from "@/lib/revenue-types"

const ENABLED_CODES_SETTING_KEY = "revenueTypes.enabledCodes"
const CUSTOM_DEFINITIONS_SETTING_KEY = "revenueTypes.customDefinitions"

type RevenueCategory = "NRC" | "MRC"

export type RevenueTypeOption = { value: string; label: string }

interface CustomRevenueTypeDefinition {
  code: string
  label: string
  description: string
  category: RevenueCategory
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

async function getCustomDefinitionsForTenant(tenantId: string): Promise<CustomRevenueTypeDefinition[]> {
  const setting = await prisma.systemSetting.findUnique({
    where: { tenantId_key: { tenantId, key: CUSTOM_DEFINITIONS_SETTING_KEY } }
  })

  const parsed = parseSettingArray(setting?.value)
  const result: CustomRevenueTypeDefinition[] = []

  for (const item of parsed) {
    if (!item || typeof item !== "object") continue
    const value = item as any
    const code = typeof value.code === "string" ? value.code.trim() : ""
    const label = typeof value.label === "string" ? value.label.trim() : ""
    const description = typeof value.description === "string" ? value.description.trim() : ""
    const category: RevenueCategory | null =
      value.category === "NRC" || value.category === "MRC" ? value.category : null
    if (!code || !label || !category) continue
    result.push({ code, label, description, category })
  }

  return result
}

async function getEnabledCodesForTenant(tenantId: string, fallbackCodes: string[]): Promise<Set<string>> {
  const setting = await prisma.systemSetting.findUnique({
    where: { tenantId_key: { tenantId, key: ENABLED_CODES_SETTING_KEY } }
  })

  const parsed = parseSettingArray(setting?.value)
  if (parsed.length === 0) return new Set(fallbackCodes)

  const enabled = new Set<string>()
  for (const value of parsed) {
    if (typeof value === "string" && value.trim().length > 0) {
      enabled.add(value.trim())
    }
  }
  return enabled.size > 0 ? enabled : new Set(fallbackCodes)
}

export async function getEnabledRevenueTypeOptions(tenantId: string): Promise<RevenueTypeOption[]> {
  const customDefinitions = await getCustomDefinitionsForTenant(tenantId)
  const allDefinitions: RevenueTypeOption[] = [
    ...REVENUE_TYPE_DEFINITIONS.map((def) => ({ value: def.code, label: def.label })),
    ...customDefinitions.map((def) => ({ value: def.code, label: def.label }))
  ]

  const enabledCodes = await getEnabledCodesForTenant(
    tenantId,
    allDefinitions.map((d) => d.value)
  )

  return allDefinitions.filter((def) => enabledCodes.has(def.value))
}

export async function isEnabledRevenueType(tenantId: string, code: string): Promise<boolean> {
  const options = await getEnabledRevenueTypeOptions(tenantId)
  return options.some((opt) => opt.value === code)
}

