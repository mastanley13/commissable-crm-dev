import {
  AuditAction,
  DepositLineMatchStatus,
  Prisma,
  PrismaClient,
  RevenueScheduleStatus,
} from "@prisma/client"
import { logRevenueScheduleAudit } from "@/lib/audit"

type PrismaClientOrTx = PrismaClient | Prisma.TransactionClient

const EPSILON = 0.005

function toNumber(value: unknown): number {
  const numeric = Number(value ?? 0)
  return Number.isFinite(numeric) ? numeric : 0
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

  if (scope.kind === "opportunityProductId") {
    const schedules = await client.revenueSchedule.findMany({
      where: {
        ...commonWhere,
        opportunityProductId: scope.opportunityProductId,
      },
      select: {
        id: true,
        scheduleNumber: true,
        scheduleDate: true,
        status: true,
        expectedUsage: true,
        usageAdjustment: true,
        expectedCommission: true,
      },
      orderBy: { scheduleDate: "asc" },
    })
    return schedules.map(row => ({
      ...row,
      expectedUsage: row.expectedUsage == null ? null : toNumber(row.expectedUsage),
      usageAdjustment: row.usageAdjustment == null ? null : toNumber(row.usageAdjustment),
      expectedCommission: row.expectedCommission == null ? null : toNumber(row.expectedCommission),
    }))
  }

  if (scope.kind === "accountProductId") {
    const schedules = await client.revenueSchedule.findMany({
      where: {
        ...commonWhere,
        productId: scope.productId,
      },
      select: {
        id: true,
        scheduleNumber: true,
        scheduleDate: true,
        status: true,
        expectedUsage: true,
        usageAdjustment: true,
        expectedCommission: true,
      },
      orderBy: { scheduleDate: "asc" },
    })
    return schedules.map(row => ({
      ...row,
      expectedUsage: row.expectedUsage == null ? null : toNumber(row.expectedUsage),
      usageAdjustment: row.usageAdjustment == null ? null : toNumber(row.usageAdjustment),
      expectedCommission: row.expectedCommission == null ? null : toNumber(row.expectedCommission),
    }))
  }

  const schedules = await client.revenueSchedule.findMany({
    where: commonWhere,
    select: {
      id: true,
      scheduleNumber: true,
      scheduleDate: true,
      status: true,
      expectedUsage: true,
      usageAdjustment: true,
      expectedCommission: true,
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
  })

  return schedules
    .filter(row => computeScheduleScopeKey(row) === scope.key)
    .map(row => ({
      id: row.id,
      scheduleNumber: row.scheduleNumber ?? null,
      scheduleDate: row.scheduleDate ?? null,
      status: row.status,
      expectedUsage: row.expectedUsage == null ? null : toNumber(row.expectedUsage),
      usageAdjustment: row.usageAdjustment == null ? null : toNumber(row.usageAdjustment),
      expectedCommission: row.expectedCommission == null ? null : toNumber(row.expectedCommission),
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

  const schedules =
    scope.kind === "opportunityProductId"
      ? await baseQuery({ ...commonWhere, opportunityProductId: scope.opportunityProductId })
      : scope.kind === "accountProductId"
        ? await baseQuery({ ...commonWhere, productId: scope.productId })
        : await baseQuery(commonWhere)

  const filtered =
    scope.kind === "normalizedVendorProductKey"
      ? schedules.filter(row => computeScheduleScopeKey(row) === scope.key)
      : schedules

  return filtered.map(row => {
    const expectedUsageNet = toNumber(row.expectedUsage) + toNumber(row.usageAdjustment)
    const actualUsageNet = toNumber(row.actualUsage) + toNumber(row.actualUsageAdjustment)
    const usageBalance = expectedUsageNet - actualUsageNet

    const expectedCommissionNet = toNumber(row.expectedCommission)
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

  for (const schedule of schedules) {
    const previousUsageAdjustment = toNumber(schedule.usageAdjustment)
    const previousExpectedCommission = toNumber(schedule.expectedCommission)

    const nextUsageAdjustment =
      Math.abs(usageDelta) <= EPSILON ? previousUsageAdjustment : previousUsageAdjustment + usageDelta
    const nextExpectedCommission =
      Math.abs(commissionDelta) <= EPSILON ? previousExpectedCommission : previousExpectedCommission + commissionDelta

    if (
      Math.abs(nextUsageAdjustment - previousUsageAdjustment) <= EPSILON &&
      Math.abs(nextExpectedCommission - previousExpectedCommission) <= EPSILON
    ) {
      continue
    }

    await client.revenueSchedule.update({
      where: { id: schedule.id },
      data: {
        usageAdjustment: nextUsageAdjustment,
        expectedCommission: nextExpectedCommission,
      },
    })

    updatedScheduleIds.push(schedule.id)

    await logRevenueScheduleAudit(
      AuditAction.Update,
      schedule.id,
      userId,
      tenantId,
      request,
      {
        usageAdjustment: schedule.usageAdjustment ?? null,
        expectedCommission: schedule.expectedCommission ?? null,
      },
      {
        action: "ApplyExpectedDeltaToFutureSchedule",
        sourceScheduleId,
        depositId,
        depositLineItemId,
        usageDelta,
        commissionDelta,
        usageAdjustment: nextUsageAdjustment,
        expectedCommission: nextExpectedCommission,
      },
    )
  }

  return { updatedScheduleIds }
}

