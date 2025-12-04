import { prisma } from "@/lib/db"

const VARIANCE_SETTING_KEY = "reconciliation.varianceTolerance"
const FUTURE_SCHEDULE_SETTING_KEY = "reconciliation.includeFutureSchedulesDefault"
const ENGINE_MODE_SETTING_KEY = "reconciliation.engineMode"
const DEFAULT_VARIANCE_TOLERANCE = Number(process.env.DEFAULT_VARIANCE_TOLERANCE ?? 0) / 100

export type MatchingEngineMode = "env" | "legacy" | "hierarchical"

// Hierarchical matching is now the primary/default engine.
const DEFAULT_ENGINE_MODE: MatchingEngineMode = "hierarchical"

function deserializeSettingValue(raw: unknown): unknown {
  if (raw == null) return raw
  if (typeof raw !== "string") return raw
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

function normalizeTolerance(raw: unknown): number {
  const value = deserializeSettingValue(raw)
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  if (value && typeof value === "object" && "value" in (value as Record<string, unknown>)) {
    const nested = (value as Record<string, unknown>).value
    return normalizeTolerance(nested)
  }
  return DEFAULT_VARIANCE_TOLERANCE
}

function normalizeBoolean(raw: unknown, fallback = false): boolean {
  const value = deserializeSettingValue(raw)
  if (typeof value === "boolean") return value
  if (typeof value === "string") {
    const lowered = value.toLowerCase()
    if (["true", "1", "yes", "y"].includes(lowered)) return true
    if (["false", "0", "no", "n"].includes(lowered)) return false
  }
  return fallback
}

function normalizeEngineMode(raw: unknown): MatchingEngineMode {
  const value = deserializeSettingValue(raw)
  if (value === "legacy" || value === "hierarchical" || value === "env") {
    return value
  }
  if (typeof value === "string") {
    const lowered = value.toLowerCase()
    if (lowered === "legacy") return "legacy"
    if (lowered === "hierarchical") return "hierarchical"
  }
  return DEFAULT_ENGINE_MODE
}

export async function getTenantVarianceTolerance(tenantId: string): Promise<number> {
  const prefs = await getTenantMatchingPreferences(tenantId)
  return prefs.varianceTolerance
}

export function getDefaultVarianceTolerance() {
  return DEFAULT_VARIANCE_TOLERANCE
}

export async function getTenantMatchingPreferences(tenantId: string): Promise<{
  varianceTolerance: number
  includeFutureSchedulesDefault: boolean
  engineMode: MatchingEngineMode
}> {
  if (!tenantId) {
    return {
      varianceTolerance: DEFAULT_VARIANCE_TOLERANCE,
      includeFutureSchedulesDefault: false,
      engineMode: DEFAULT_ENGINE_MODE,
    }
  }

  try {
    const settings = await prisma.systemSetting.findMany({
      where: {
        tenantId,
        key: { in: [VARIANCE_SETTING_KEY, FUTURE_SCHEDULE_SETTING_KEY, ENGINE_MODE_SETTING_KEY] },
      },
      select: { key: true, value: true },
    })
    const map = new Map(settings.map(setting => [setting.key, setting.value]))

    const varianceTolerance = normalizeTolerance(map.get(VARIANCE_SETTING_KEY))
    const includeFutureSchedulesDefault = normalizeBoolean(map.get(FUTURE_SCHEDULE_SETTING_KEY), false)
    const engineMode = normalizeEngineMode(map.get(ENGINE_MODE_SETTING_KEY))

    return {
      varianceTolerance: Math.max(0, Math.min(1, varianceTolerance)),
      includeFutureSchedulesDefault,
      engineMode,
    }
  } catch (error) {
    console.error("Failed to load reconciliation settings", error)
    return {
      varianceTolerance: DEFAULT_VARIANCE_TOLERANCE,
      includeFutureSchedulesDefault: false,
      engineMode: DEFAULT_ENGINE_MODE,
    }
  }
}

export async function saveTenantMatchingPreferences(
  tenantId: string,
  prefs: Partial<{
    varianceTolerance: number
    includeFutureSchedulesDefault: boolean
    engineMode: MatchingEngineMode
  }>,
) {
  if (!tenantId) {
    throw new Error("tenantId is required to save reconciliation settings")
  }

  const payload: Array<{ key: string; value: unknown }> = []
  if (prefs.varianceTolerance != null) {
    payload.push({ key: VARIANCE_SETTING_KEY, value: prefs.varianceTolerance })
  }
  if (prefs.includeFutureSchedulesDefault != null) {
    payload.push({ key: FUTURE_SCHEDULE_SETTING_KEY, value: prefs.includeFutureSchedulesDefault })
  }
  if (prefs.engineMode != null) {
    payload.push({ key: ENGINE_MODE_SETTING_KEY, value: prefs.engineMode })
  }

  if (payload.length === 0) return

  await Promise.all(
    payload.map(({ key, value }) =>
      prisma.systemSetting.upsert({
        where: { tenantId_key: { tenantId, key } },
        update: {
          value: JSON.stringify(value),
        },
        create: {
          tenantId,
          key,
          value: JSON.stringify(value),
          description: `Reconciliation setting for ${key}`,
          scope: "Tenant",
        },
      }),
    ),
  )
}
