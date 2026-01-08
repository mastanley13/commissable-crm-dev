import { prisma } from "@/lib/db"

const SUGGESTED_MATCHES_MIN_CONFIDENCE_KEY = "reconciliation.suggestedMatchesMinConfidence"
const AUTO_MATCH_MIN_CONFIDENCE_KEY = "reconciliation.autoMatchMinConfidence"

const DEFAULT_SUGGESTED_MATCHES_MIN_CONFIDENCE = 0.75
const DEFAULT_AUTO_MATCH_MIN_CONFIDENCE = 0.95

function deserializeSettingValue(raw: unknown): unknown {
  if (raw == null) return raw
  if (typeof raw !== "string") return raw
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

function normalizeConfidence(raw: unknown, fallback: number): number {
  const value = deserializeSettingValue(raw)
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  if (value && typeof value === "object" && "value" in (value as Record<string, unknown>)) {
    const nested = (value as Record<string, unknown>).value
    return normalizeConfidence(nested, fallback)
  }
  return fallback
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value))
}

export type UserReconciliationConfidencePreferences = {
  suggestedMatchesMinConfidence: number
  autoMatchMinConfidence: number
}

export function getDefaultUserReconciliationConfidencePreferences(): UserReconciliationConfidencePreferences {
  return {
    suggestedMatchesMinConfidence: DEFAULT_SUGGESTED_MATCHES_MIN_CONFIDENCE,
    autoMatchMinConfidence: DEFAULT_AUTO_MATCH_MIN_CONFIDENCE,
  }
}

export async function getUserReconciliationConfidencePreferences(
  tenantId: string,
  userId: string,
): Promise<UserReconciliationConfidencePreferences> {
  if (!tenantId || !userId) {
    return getDefaultUserReconciliationConfidencePreferences()
  }

  try {
    const settings = await prisma.userSetting.findMany({
      where: {
        tenantId,
        userId,
        key: { in: [SUGGESTED_MATCHES_MIN_CONFIDENCE_KEY, AUTO_MATCH_MIN_CONFIDENCE_KEY] },
      },
      select: { key: true, value: true },
    })
    const map = new Map(settings.map(setting => [setting.key, setting.value]))

    const defaults = getDefaultUserReconciliationConfidencePreferences()
    const suggestedMatchesMinConfidence = clamp01(
      normalizeConfidence(map.get(SUGGESTED_MATCHES_MIN_CONFIDENCE_KEY), defaults.suggestedMatchesMinConfidence),
    )
    const autoMatchMinConfidence = clamp01(
      normalizeConfidence(map.get(AUTO_MATCH_MIN_CONFIDENCE_KEY), defaults.autoMatchMinConfidence),
    )

    return { suggestedMatchesMinConfidence, autoMatchMinConfidence }
  } catch (error) {
    console.error("Failed to load user reconciliation confidence settings", error)
    return getDefaultUserReconciliationConfidencePreferences()
  }
}

export async function saveUserReconciliationConfidencePreferences(
  tenantId: string,
  userId: string,
  updates: Partial<UserReconciliationConfidencePreferences>,
) {
  if (!tenantId || !userId) {
    throw new Error("tenantId and userId are required to save user reconciliation settings")
  }

  const payload: Array<{ key: string; value: unknown }> = []

  if (updates.suggestedMatchesMinConfidence != null) {
    payload.push({
      key: SUGGESTED_MATCHES_MIN_CONFIDENCE_KEY,
      value: clamp01(Number(updates.suggestedMatchesMinConfidence)),
    })
  }

  if (updates.autoMatchMinConfidence != null) {
    payload.push({
      key: AUTO_MATCH_MIN_CONFIDENCE_KEY,
      value: clamp01(Number(updates.autoMatchMinConfidence)),
    })
  }

  if (!payload.length) return

  await Promise.all(
    payload.map(({ key, value }) =>
      prisma.userSetting.upsert({
        where: { userId_key: { userId, key } },
        update: {
          tenantId,
          value: JSON.stringify(value),
        },
        create: {
          tenantId,
          userId,
          key,
          value: JSON.stringify(value),
          description: `User reconciliation setting for ${key}`,
        },
      }),
    ),
  )
}

