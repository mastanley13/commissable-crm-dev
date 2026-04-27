import type { Prisma } from "@prisma/client"

export function startOfDepositMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

export function normalizeDepositImportNumber(value: string | null | undefined) {
  if (value === undefined || value === null) {
    return null
  }
  const normalized = value.replace(/[^0-9.\-]/g, "")
  if (!normalized) return null
  const numeric = Number(normalized)
  if (Number.isNaN(numeric)) return null
  return numeric
}

export function normalizeDepositImportString(value: string | null | undefined) {
  return value && value.trim().length > 0 ? value.trim() : null
}

export function normalizeDepositExternalKey(value: string) {
  return value.trim().toLowerCase()
}

export function parseDepositImportDateInput(value: string | null | undefined): {
  value: Date | null
  valid: boolean
} {
  const trimmed = (value ?? "").trim()
  if (!trimmed) {
    return { value: null, valid: true }
  }

  const numeric = Number(trimmed)
  if (Number.isFinite(numeric) && numeric > 20000 && numeric < 60000) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30))
    return {
      value: new Date(excelEpoch.getTime() + numeric * 24 * 60 * 60 * 1000),
      valid: true
    }
  }

  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) {
    return { value: null, valid: false }
  }

  return { value: parsed, valid: true }
}

export function parseDepositImportDate(
  value: string | null | undefined,
  fallback?: Date
) {
  const parsed = parseDepositImportDateInput(value)
  if (!parsed.valid) {
    return fallback ?? null
  }
  return parsed.value ?? fallback ?? null
}

export function parseDepositCommissionPeriodInput(value: string | null | undefined): {
  value: Date | null
  valid: boolean
} {
  const trimmed = (value ?? "").trim()
  if (!trimmed) {
    return { value: null, valid: true }
  }

  const match = /^(\d{4})-(\d{2})$/.exec(trimmed)
  if (!match) {
    return { value: null, valid: false }
  }

  const year = Number(match[1])
  const month = Number(match[2])
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return { value: null, valid: false }
  }

  return {
    value: new Date(Date.UTC(year, month - 1, 1)),
    valid: true
  }
}

export function parseDepositImportBoolean(value: string | null | undefined) {
  const normalized = (value ?? "").trim().toLowerCase()
  if (!normalized) return null
  if (["true", "yes", "1", "y"].includes(normalized)) return true
  if (["false", "no", "0", "n"].includes(normalized)) return false
  return null
}

export function parseDepositImportBooleanInput(value: string | null | undefined): {
  value: boolean | null
  valid: boolean
} {
  const normalized = (value ?? "").trim()
  if (!normalized) {
    return { value: null, valid: true }
  }

  const parsed = parseDepositImportBoolean(normalized)
  if (parsed === null) {
    return { value: null, valid: false }
  }

  return { value: parsed, valid: true }
}

export function isDepositImportPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

export function setDepositImportMetadataValue(
  metadata: Record<string, unknown>,
  path: string[],
  value: unknown
) {
  if (!path.length) return
  let cursor: Record<string, unknown> = metadata
  for (let index = 0; index < path.length - 1; index += 1) {
    const key = path[index]
    if (!isDepositImportPlainObject(cursor[key])) {
      cursor[key] = {}
    }
    cursor = cursor[key] as Record<string, unknown>
  }
  cursor[path[path.length - 1]] = value
}

export function toDepositImportJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue
}

export async function refreshDepositAggregateTotals(
  tx: Prisma.TransactionClient,
  tenantId: string,
  depositId: string
) {
  const aggregate = await tx.depositLineItem.aggregate({
    where: { tenantId, depositId },
    _count: { id: true },
    _sum: {
      usage: true,
      usageAllocated: true,
      usageUnallocated: true,
      commission: true,
      commissionAllocated: true,
      commissionUnallocated: true
    }
  })

  await tx.deposit.update({
    where: { id: depositId },
    data: {
      totalItems: aggregate._count.id,
      itemsUnreconciled: aggregate._count.id,
      totalUsage: aggregate._sum.usage ?? 0,
      usageAllocated: aggregate._sum.usageAllocated ?? 0,
      usageUnallocated: aggregate._sum.usageUnallocated ?? 0,
      totalCommissions: aggregate._sum.commission ?? 0,
      commissionAllocated: aggregate._sum.commissionAllocated ?? 0,
      commissionUnallocated: aggregate._sum.commissionUnallocated ?? 0
    }
  })
}

export async function createDepositLineItemsAndRefreshTotals(
  tx: Prisma.TransactionClient,
  params: {
    tenantId: string
    depositId: string
    lineItemsData: Prisma.DepositLineItemCreateManyInput[]
  }
) {
  await tx.depositLineItem.createMany({
    data: params.lineItemsData
  })

  await refreshDepositAggregateTotals(tx, params.tenantId, params.depositId)
}
