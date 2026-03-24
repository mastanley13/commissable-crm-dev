import {
  AuditAction,
  DepositLineMatchStatus,
  Prisma,
  PrismaClient,
  RevenueScheduleStatus,
} from "@prisma/client"
import { logRevenueScheduleAudit } from "@/lib/audit"
import { roundCurrency } from "@/lib/revenue-schedule-calculations"
import {
  createRevenueScheduleAdjustmentWithUndo,
  listRevenueScheduleAdjustmentSums,
  roundMoney,
} from "@/lib/reconciliation/revenue-schedule-adjustments"

type PrismaClientOrTx = PrismaClient | Prisma.TransactionClient

const EPSILON = 0.005

function toNumber(value: unknown): number {
  const numeric = Number(value ?? 0)
  return Number.isFinite(numeric) ? numeric : 0
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function normalizeKeyPart(value: unknown): string {
  if (value == null) return ""
  const str = String(value)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[\-_.\/\\|:;,'"()[\]{}<>!?@#$%^&*+=~`]/g, "")
  return str
}

function firstNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (typeof value !== "string") continue
    const trimmed = value.trim()
    if (trimmed) return trimmed
  }
  return null
}

export type ScheduleScopeKey =
  | { kind: "opportunityProductId"; accountId: string; opportunityProductId: string }
  | { kind: "accountProductId"; accountId: string; productId: string }
  | { kind: "normalizedVendorProductKey"; accountId: string; key: string }

export type ScopedSchedule = {
  id: string
  scheduleNumber: string | null
  scheduleDate: Date | null
  status: RevenueScheduleStatus
  expectedUsage: number | null
  usageAdjustment: number | null
  expectedCommission: number | null
  expectedCommissionAdjustment: number | null
  ledgerUsageAdjustment?: number | null
  ledgerCommissionAdjustment?: number | null
}

export function buildNormalizedVendorProductKey({
  vendorId,
  vendorName,
  distributorId,
  distributorName,
  code,
  uom,
}: {
  vendorId: string | null
  vendorName: string | null
  distributorId: string | null
  distributorName: string | null
  code: string | null
  uom?: string | null
}): string {
  const vendorPart = normalizeKeyPart(vendorId ?? vendorName ?? "")
  const distPart = normalizeKeyPart(distributorId ?? distributorName ?? "")
  const codePart = normalizeKeyPart(code ?? "")
  const uomPart = normalizeKeyPart(uom ?? "")

  return `vendor:${vendorPart}|dist:${distPart}|code:${codePart}${uomPart ? `|uom:${uomPart}` : ""}`
}

export function resolveScheduleScopeKey(baseSchedule: {
  accountId: string
  opportunityProductId: string | null
  productId: string | null
  vendorAccountId: string | null
  distributorAccountId: string | null
  vendor?: { accountName: string | null } | null
  distributor?: { accountName: string | null } | null
  product?: {
    productCode: string
    partNumberVendor: string | null
    partNumberDistributor: string | null
    partNumberHouse: string | null
  } | null
}): ScheduleScopeKey {
  if (baseSchedule.opportunityProductId) {
    return {
      kind: "opportunityProductId",
      accountId: baseSchedule.accountId,
      opportunityProductId: baseSchedule.opportunityProductId,
    }
  }

  if (baseSchedule.productId) {
    return {
      kind: "accountProductId",
      accountId: baseSchedule.accountId,
      productId: baseSchedule.productId,
    }
  }

  const code = firstNonEmpty(
    baseSchedule.product?.partNumberVendor,
    baseSchedule.product?.partNumberDistributor,
    baseSchedule.product?.productCode,
    baseSchedule.product?.partNumberHouse,
  )

  const key = buildNormalizedVendorProductKey({
    vendorId: baseSchedule.vendorAccountId,
    vendorName: baseSchedule.vendor?.accountName ?? null,
    distributorId: baseSchedule.distributorAccountId,
    distributorName: baseSchedule.distributor?.accountName ?? null,
    code,
  })

  const normalizedCode = normalizeKeyPart(code ?? "")
  if (!normalizedCode) {
    throw new Error("Unable to resolve product scope key: missing product identifiers")
  }

  return {
    kind: "normalizedVendorProductKey",
    accountId: baseSchedule.accountId,
    key,
  }
}

function computeScheduleScopeKey(schedule: {
  vendorAccountId: string | null
  distributorAccountId: string | null
  vendor?: { accountName: string | null } | null
  distributor?: { accountName: string | null } | null
  product?: {
    productCode: string
    partNumberVendor: string | null
    partNumberDistributor: string | null
    partNumberHouse: string | null
  } | null
}): string {
  const code = firstNonEmpty(
    schedule.product?.partNumberVendor,
    schedule.product?.partNumberDistributor,
    schedule.product?.productCode,
    schedule.product?.partNumberHouse,
  )
  return buildNormalizedVendorProductKey({
    vendorId: schedule.vendorAccountId,
    vendorName: schedule.vendor?.accountName ?? null,
    distributorId: schedule.distributorAccountId,
    distributorName: schedule.distributor?.accountName ?? null,
    code,
  })
}

export async function findFutureSchedulesInScope(
  client: PrismaClientOrTx,
  {
    tenantId,
    baseScheduleId,
    baseScheduleDate,
    scope,
    excludeAllocated = true,
  }: {
    tenantId: string
    baseScheduleId: string
    baseScheduleDate: Date
    scope: ScheduleScopeKey
    excludeAllocated?: boolean
  },
): Promise<ScopedSchedule[]> {
  const commonWhere: Prisma.RevenueScheduleWhereInput = {
    tenantId,
    accountId: scope.accountId,
    deletedAt: null,
    status: { not: RevenueScheduleStatus.Reconciled },
    scheduleDate: { gt: baseScheduleDate },
    id: { not: baseScheduleId },
    ...(excludeAllocated
      ? {
          depositLineMatches: {
            none: {
              status: DepositLineMatchStatus.Applied,
            },
          },
        }
      : {}),
  }

  const schedules = (await client.revenueSchedule.findMany({
    where: commonWhere,
    select: {
      id: true,
      opportunityProductId: true,
      productId: true,
      scheduleNumber: true,
      scheduleDate: true,
      status: true,
      expectedUsage: true,
      usageAdjustment: true,
      expectedCommission: true,
      // Keep this select resilient if Prisma types haven't been regenerated yet.
      ...( { expectedCommissionAdjustment: true } as any ),
      vendorAccountId: true,
      distributorAccountId: true,
      vendor: { select: { accountName: true } },
      distributor: { select: { accountName: true } },
      product: {
        select: {
          productCode: true,
          partNumberVendor: true,
          partNumberDistributor: true,
          partNumberHouse: true,
        },
      },
    },
    orderBy: { scheduleDate: "asc" },
  })) as any[]

  const filtered =
    scope.kind === "opportunityProductId"
      ? schedules.filter(row => row.opportunityProductId === scope.opportunityProductId)
      : scope.kind === "accountProductId"
        ? schedules.filter(row => row.productId === scope.productId)
        : schedules.filter(row => computeScheduleScopeKey(row) === scope.key)

  const ledgerAdjustmentSums = await listRevenueScheduleAdjustmentSums(client, {
    tenantId,
    revenueScheduleIds: filtered.map(row => row.id),
  })

  return filtered.map(row => ({
    id: row.id,
    scheduleNumber: row.scheduleNumber ?? null,
    scheduleDate: row.scheduleDate ?? null,
    status: row.status,
    expectedUsage: row.expectedUsage == null ? null : toNumber(row.expectedUsage),
    usageAdjustment: row.usageAdjustment == null ? null : toNumber(row.usageAdjustment),
    expectedCommission: row.expectedCommission == null ? null : toNumber(row.expectedCommission),
    expectedCommissionAdjustment:
      (row as any).expectedCommissionAdjustment == null ? null : toNumber((row as any).expectedCommissionAdjustment),
    ledgerUsageAdjustment: ledgerAdjustmentSums.get(row.id)?.usageAmount ?? 0,
    ledgerCommissionAdjustment: ledgerAdjustmentSums.get(row.id)?.commissionAmount ?? 0,
  }))
}

export async function findPriorOpenSchedulesInScope(
  client: PrismaClientOrTx,
  {
    tenantId,
    baseScheduleId,
    baseScheduleDate,
    scope,
    limit = 25,
  }: {
    tenantId: string
    baseScheduleId: string
    baseScheduleDate: Date
    scope: ScheduleScopeKey
    limit?: number
  },
): Promise<Array<{ id: string; usageBalance: number; commissionDifference: number }>> {
  const commonWhere: Prisma.RevenueScheduleWhereInput = {
    tenantId,
    accountId: scope.accountId,
    deletedAt: null,
    status: { not: RevenueScheduleStatus.Reconciled },
    scheduleDate: { lt: baseScheduleDate },
    id: { not: baseScheduleId },
  }

  const select = {
    id: true,
    expectedUsage: true,
    usageAdjustment: true,
    actualUsage: true,
    actualUsageAdjustment: true,
    expectedCommission: true,
    // Keep this select resilient if Prisma types haven't been regenerated yet.
    ...( { expectedCommissionAdjustment: true } as any ),
    actualCommission: true,
    actualCommissionAdjustment: true,
    vendorAccountId: true,
    distributorAccountId: true,
    vendor: { select: { accountName: true } },
    distributor: { select: { accountName: true } },
    product: {
      select: {
        productCode: true,
        partNumberVendor: true,
        partNumberDistributor: true,
        partNumberHouse: true,
      },
    },
  } satisfies Prisma.RevenueScheduleSelect

  const baseQuery = (where: Prisma.RevenueScheduleWhereInput) =>
    client.revenueSchedule.findMany({
      where,
      select,
      orderBy: { scheduleDate: "desc" },
      take: limit,
    })

  const schedules = (scope.kind === "opportunityProductId"
    ? await baseQuery({ ...commonWhere, opportunityProductId: scope.opportunityProductId })
    : scope.kind === "accountProductId"
      ? await baseQuery({ ...commonWhere, productId: scope.productId })
      : await baseQuery(commonWhere)) as any[]

  const filtered =
    scope.kind === "normalizedVendorProductKey"
      ? schedules.filter(row => computeScheduleScopeKey(row) === scope.key)
      : schedules

  const ledgerAdjustmentSums = await listRevenueScheduleAdjustmentSums(client, {
    tenantId,
    revenueScheduleIds: filtered.map(row => row.id),
  })

  return filtered.map(row => {
    const expectedUsageNet =
      toNumber(row.expectedUsage) + toNumber(row.usageAdjustment) + toNumber(ledgerAdjustmentSums.get(row.id)?.usageAmount)
    const actualUsageNet = toNumber(row.actualUsage) + toNumber(row.actualUsageAdjustment)
    const usageBalance = expectedUsageNet - actualUsageNet

    const expectedCommissionNet =
      toNumber(row.expectedCommission) +
      toNumber((row as any).expectedCommissionAdjustment ?? (row as any).actualCommissionAdjustment) +
      toNumber(ledgerAdjustmentSums.get(row.id)?.commissionAmount)
    const actualCommissionNet = toNumber(row.actualCommission) + toNumber(row.actualCommissionAdjustment)
    const commissionDifference = expectedCommissionNet - actualCommissionNet

    return { id: row.id, usageBalance, commissionDifference }
  })
}

export async function applyExpectedDeltasToFutureSchedules(
  client: PrismaClientOrTx,
  {
    tenantId,
    userId,
    request,
    schedules,
    usageDelta,
    commissionDelta,
    sourceScheduleId,
    depositId,
    depositLineItemId,
  }: {
    tenantId: string
    userId: string
    request?: Request
    schedules: ScopedSchedule[]
    usageDelta: number
    commissionDelta: number
    sourceScheduleId: string
    depositId: string
    depositLineItemId: string
  },
) {
  const updatedScheduleIds: string[] = []
  const createdAdjustmentIds: string[] = []

  for (const schedule of schedules) {
    if (Math.abs(usageDelta) <= EPSILON && Math.abs(commissionDelta) <= EPSILON) {
      continue
    }

    const createdAdjustment = await createRevenueScheduleAdjustmentWithUndo(client, {
      tenantId,
      depositId,
      depositLineItemId,
      userId,
      revenueScheduleId: schedule.id,
      adjustmentType: "adjustment_forward",
      applicationScope: "forward_adjustment",
      usageAmount: usageDelta,
      commissionAmount: commissionDelta,
      effectiveScheduleDate: schedule.scheduleDate ?? null,
      reason: `Forward adjustment from schedule ${sourceScheduleId}`,
      relatedRevenueScheduleIds: [sourceScheduleId, schedule.id],
    })

    if (!createdAdjustment) continue

    updatedScheduleIds.push(schedule.id)
    createdAdjustmentIds.push(createdAdjustment.id)

    await logRevenueScheduleAudit(
      AuditAction.Update,
      schedule.id,
      userId,
      tenantId,
      request,
      {
        usageAdjustment: schedule.usageAdjustment ?? null,
        expectedCommissionAdjustment: schedule.expectedCommissionAdjustment ?? null,
        ledgerUsageAdjustment: schedule.ledgerUsageAdjustment ?? 0,
        ledgerCommissionAdjustment: schedule.ledgerCommissionAdjustment ?? 0,
      },
      {
        action: "ApplyExpectedDeltaToFutureSchedule",
        sourceScheduleId,
        depositId,
        depositLineItemId,
        usageDelta,
        commissionDelta,
        adjustmentId: createdAdjustment.id,
        ledgerUsageAdjustment: roundMoney(toNumber(schedule.ledgerUsageAdjustment) + usageDelta),
        ledgerCommissionAdjustment: roundMoney(toNumber(schedule.ledgerCommissionAdjustment) + commissionDelta),
      },
    )
  }

  return { updatedScheduleIds, createdAdjustmentIds }
}

export async function applyReceivedRateToFutureSchedules(
  client: PrismaClientOrTx,
  {
    tenantId,
    userId,
    request,
    schedules,
    receivedRatePercent,
    sourceScheduleId,
    depositId,
    depositLineItemId,
  }: {
    tenantId: string
    userId: string
    request?: Request
    schedules: ScopedSchedule[]
    receivedRatePercent: number
    sourceScheduleId: string
    depositId: string
    depositLineItemId: string
  },
) {
  const updatedScheduleIds: string[] = []

  for (const scheduleRef of schedules) {
    const result = await applyReceivedRateToSchedule(client, {
      tenantId,
      userId,
      request,
      scheduleId: scheduleRef.id,
      receivedRatePercent,
      sourceScheduleId,
      depositId,
      depositLineItemId,
      auditAction: "ApplyReceivedCommissionRateToFutureSchedule",
      skipIfMissing: true,
    })
    if (result.updatedScheduleId) {
      updatedScheduleIds.push(result.updatedScheduleId)
    }
  }

  return { updatedScheduleIds }
}

export async function applyReceivedRateToSchedule(
  client: PrismaClientOrTx,
  {
    tenantId,
    userId,
    request,
    scheduleId,
    receivedRatePercent,
    sourceScheduleId,
    depositId,
    depositLineItemId,
    auditAction,
    skipIfMissing = false,
  }: {
    tenantId: string
    userId: string
    request?: Request
    scheduleId: string
    receivedRatePercent: number
    sourceScheduleId: string
    depositId: string
    depositLineItemId: string
    auditAction: string
    skipIfMissing?: boolean
  },
) {
  const schedule = await client.revenueSchedule.findFirst({
    where: {
      id: scheduleId,
      tenantId,
      deletedAt: null,
      status: { not: RevenueScheduleStatus.Reconciled },
    },
    select: {
      id: true,
      expectedUsage: true,
      expectedCommission: true,
      expectedCommissionRatePercent: true,
      opportunityProduct: {
        select: {
          quantity: true,
          unitPrice: true,
          expectedUsage: true,
        },
      },
      product: {
        select: {
          priceEach: true,
        },
      },
    },
  })

  if (!schedule) {
    if (skipIfMissing) return { updatedScheduleId: null as string | null }
    throw new Error(`Revenue schedule ${scheduleId} was not found or cannot be updated`)
  }

  const previousRatePercent = toNullableNumber((schedule as any).expectedCommissionRatePercent)
  const previousExpectedCommission = toNullableNumber((schedule as any).expectedCommission)

  const fallbackQuantity = toNullableNumber((schedule.opportunityProduct as any)?.quantity)
  const fallbackUnitPrice =
    toNullableNumber((schedule.opportunityProduct as any)?.unitPrice) ??
    toNullableNumber((schedule.product as any)?.priceEach)

  const existingUsage = toNullableNumber((schedule as any).expectedUsage)
  const fallbackExpectedUsage = toNullableNumber((schedule.opportunityProduct as any)?.expectedUsage)
  const derivedUsage =
    existingUsage ??
    fallbackExpectedUsage ??
    (fallbackQuantity !== null &&
    fallbackUnitPrice !== null &&
    Number.isFinite(fallbackQuantity) &&
    Number.isFinite(fallbackUnitPrice)
      ? roundCurrency(fallbackQuantity * fallbackUnitPrice)
      : null)

  if (derivedUsage === null) {
    throw new Error(`Unable to recompute expected commission for schedule ${schedule.id}: missing expected usage`)
  }

  const nextExpectedCommission = roundCurrency(derivedUsage * (receivedRatePercent / 100))

  if (
    previousRatePercent !== null &&
    Math.abs(previousRatePercent - receivedRatePercent) <= EPSILON &&
    previousExpectedCommission !== null &&
    Math.abs(previousExpectedCommission - nextExpectedCommission) <= EPSILON
  ) {
    return { updatedScheduleId: null as string | null }
  }

  await client.revenueSchedule.update({
    where: { id: schedule.id },
    data: {
      expectedCommissionRatePercent: receivedRatePercent,
      expectedCommission: nextExpectedCommission,
      ...(existingUsage == null ? { expectedUsage: derivedUsage } : {}),
    } as any,
  })

  await logRevenueScheduleAudit(
    AuditAction.Update,
    schedule.id,
    userId,
    tenantId,
    request,
    {
      expectedCommissionRatePercent: previousRatePercent,
      expectedCommission: previousExpectedCommission,
      expectedUsage: existingUsage,
    },
    {
      action: auditAction,
      sourceScheduleId,
      depositId,
      depositLineItemId,
      receivedRatePercent,
      expectedCommissionRatePercent: receivedRatePercent,
      expectedCommission: nextExpectedCommission,
      ...(existingUsage == null ? { expectedUsage: derivedUsage } : {}),
    },
  )

  return { updatedScheduleId: schedule.id }
}
