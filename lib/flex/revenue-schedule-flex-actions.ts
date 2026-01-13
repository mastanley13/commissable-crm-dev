import {
  AuditAction,
  DepositLineMatchSource,
  DepositLineMatchStatus,
  Prisma,
  PrismaClient,
  RevenueScheduleFlexClassification,
  RevenueScheduleFlexReasonCode,
  RevenueScheduleType,
} from "@prisma/client"
import { randomUUID } from "crypto"
import { generateRevenueScheduleName } from "@/lib/revenue-schedule-number"
import { recomputeRevenueScheduleFromMatches } from "@/lib/matching/revenue-schedule-status"
import { recomputeDepositAggregates } from "@/lib/matching/deposit-aggregates"
import { recomputeDepositLineItemAllocations } from "@/lib/matching/deposit-line-allocations"
import { logRevenueScheduleAudit } from "@/lib/audit"

type PrismaClientOrTx = PrismaClient | Prisma.TransactionClient

const EPSILON = 0.005

function toNumber(value: unknown): number {
  const numeric = Number(value ?? 0)
  return Number.isFinite(numeric) ? numeric : 0
}

function isEffectivelyZero(value: number): boolean {
  return Math.abs(value) <= EPSILON
}

function normalizeLabel(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function resolveRevenueType(baseRevenueType: unknown): string {
  return typeof baseRevenueType === "string" && baseRevenueType.trim() ? baseRevenueType : "MRC_ThirdParty"
}

export type FlexResolveAction = "Adjust" | "FlexProduct" | "Manual"

export interface FlexExecutionSummary {
  applied: boolean
  action: FlexResolveAction | "AutoAdjust" | "AutoChargeback" | "CreateFlexProduct"
  createdRevenueScheduleIds: string[]
  createdProductIds: string[]
}

async function createFlexProduct(
  tx: PrismaClientOrTx,
  {
    tenantId,
    userId,
    accountId,
    flexType,
    vendorAccountId,
    distributorAccountId,
    productNameVendor,
    productNameHouse,
    revenueType,
  }: {
    tenantId: string
    userId: string
    accountId: string
    flexType: string
    vendorAccountId: string | null
    distributorAccountId: string | null
    productNameVendor: string | null
    productNameHouse: string
    revenueType: string
  },
) {
  const reusable = await tx.product.findFirst({
    where: {
      tenantId,
      isFlex: true,
      flexAccountId: accountId,
      flexType,
      isActive: true,
    },
    select: { id: true },
  })

  if (reusable) {
    return reusable
  }

  const code = `FLEX-${randomUUID().slice(0, 8).toUpperCase()}`

  return tx.product.create({
    data: {
      tenantId,
      productCode: code,
      productNameHouse,
      productNameVendor,
      revenueType: resolveRevenueType(revenueType),
      isActive: true,
      isFlex: true,
      flexAccountId: accountId,
      flexType,
      vendorAccountId,
      distributorAccountId,
      productFamilyHouse: "Flex",
      createdById: userId,
      updatedById: userId,
    },
    select: { id: true },
  })
}

async function createFlexSchedule(
  tx: PrismaClientOrTx,
  {
    tenantId,
    accountId,
    opportunityId,
    opportunityProductId,
    distributorAccountId,
    vendorAccountId,
    productId,
    scheduleDate,
    expectedUsage,
    expectedCommission,
    flexClassification,
    flexReasonCode,
    flexSourceDepositId,
    flexSourceDepositLineItemId,
  }: {
    tenantId: string
    accountId: string
    opportunityId: string | null
    opportunityProductId: string | null
    distributorAccountId: string | null
    vendorAccountId: string | null
    productId: string | null
    scheduleDate: Date | null
    expectedUsage: number
    expectedCommission: number
    flexClassification: RevenueScheduleFlexClassification
    flexReasonCode: RevenueScheduleFlexReasonCode
    flexSourceDepositId: string | null
    flexSourceDepositLineItemId: string | null
  },
) {
  const scheduleNumber = await generateRevenueScheduleName(tx as any)
  return tx.revenueSchedule.create({
    data: {
      tenantId,
      opportunityId,
      opportunityProductId,
      accountId,
      productId,
      distributorAccountId,
      vendorAccountId,
      scheduleDate,
      scheduleType: RevenueScheduleType.OneTime,
      expectedUsage,
      expectedCommission,
      flexClassification,
      flexReasonCode,
      flexSourceDepositId,
      flexSourceDepositLineItemId,
      scheduleNumber,
    } as any,
    select: { id: true },
  })
}

async function applySplitMatchToNewSchedule(
  tx: PrismaClientOrTx,
  {
    tenantId,
    userId,
    depositId,
    lineItemId,
    baseScheduleId,
    splitUsage,
    splitCommission,
    scheduleData,
    varianceTolerance,
    request,
  }: {
    tenantId: string
    userId: string
    depositId: string
    lineItemId: string
    baseScheduleId: string
    splitUsage: number
    splitCommission: number
    scheduleData: Omit<
      Parameters<typeof createFlexSchedule>[1],
      "tenantId" | "expectedUsage" | "expectedCommission"
    >
    varianceTolerance: number
    request?: Request
  },
) {
  if (isEffectivelyZero(splitUsage) && isEffectivelyZero(splitCommission)) {
    return {
      createdScheduleId: null,
      updatedBaseScheduleId: baseScheduleId,
    }
  }

  const match = await tx.depositLineMatch.findFirst({
    where: {
      tenantId,
      depositLineItemId: lineItemId,
      revenueScheduleId: baseScheduleId,
      status: DepositLineMatchStatus.Applied,
    },
    select: { id: true, usageAmount: true, commissionAmount: true },
  })

  if (!match) {
    throw new Error("Cannot resolve FLEX decision: match not found")
  }

  const existingUsage = toNumber(match.usageAmount)
  const existingCommission = toNumber(match.commissionAmount)
  const keepUsage = existingUsage - splitUsage
  const keepCommission = existingCommission - splitCommission

  if (keepUsage < -EPSILON || keepCommission < -EPSILON) {
    throw new Error("FLEX split exceeds allocated amount")
  }

  const created = await createFlexSchedule(tx, {
    tenantId,
    ...scheduleData,
    expectedUsage: splitUsage,
    expectedCommission: splitCommission,
  })

  await tx.depositLineMatch.create({
    data: {
      tenantId,
      depositLineItemId: lineItemId,
      revenueScheduleId: created.id,
      usageAmount: splitUsage,
      commissionAmount: splitCommission,
      status: DepositLineMatchStatus.Applied,
      source: DepositLineMatchSource.Auto,
    },
  })

  const shouldDeleteBase = isEffectivelyZero(keepUsage) && isEffectivelyZero(keepCommission)
  if (shouldDeleteBase) {
    await tx.depositLineMatch.delete({ where: { id: match.id } })
  } else {
    await tx.depositLineMatch.update({
      where: { id: match.id },
      data: {
        usageAmount: keepUsage,
        commissionAmount: keepCommission,
        status: DepositLineMatchStatus.Applied,
      },
    })
  }

  const schedulesBefore = await tx.revenueSchedule.findMany({
    where: { tenantId, id: { in: [baseScheduleId, created.id] } },
    select: { id: true, status: true, actualUsage: true, actualCommission: true },
  })

  const updatedBase = await recomputeRevenueScheduleFromMatches(tx, baseScheduleId, tenantId, {
    varianceTolerance,
  })
  const updatedCreated = await recomputeRevenueScheduleFromMatches(tx, created.id, tenantId, {
    varianceTolerance,
  })

  const beforeBase = schedulesBefore.find(row => row.id === baseScheduleId)
  await logRevenueScheduleAudit(
    AuditAction.Update,
    baseScheduleId,
    userId,
    tenantId,
    request,
    {
      status: beforeBase?.status ?? null,
      actualUsage: beforeBase?.actualUsage ?? null,
      actualCommission: beforeBase?.actualCommission ?? null,
    },
    {
      action: "FlexSplitBase",
      depositId,
      depositLineItemId: lineItemId,
      splitUsage,
      splitCommission,
      status: updatedBase.schedule.status,
      actualUsage: updatedBase.schedule.actualUsage,
      actualCommission: updatedBase.schedule.actualCommission,
      usageBalance: updatedBase.usageBalance,
      commissionDifference: updatedBase.commissionDifference,
      matchCount: updatedBase.matchCount,
    },
  )

  const beforeCreated = schedulesBefore.find(row => row.id === created.id)
  await logRevenueScheduleAudit(
    AuditAction.Create,
    created.id,
    userId,
    tenantId,
    request,
    undefined,
    {
      action: "FlexSplitCreated",
      depositId,
      depositLineItemId: lineItemId,
      expectedUsage: splitUsage,
      expectedCommission: splitCommission,
      status: updatedCreated.schedule.status,
      actualUsage: updatedCreated.schedule.actualUsage,
      actualCommission: updatedCreated.schedule.actualCommission,
      usageBalance: updatedCreated.usageBalance,
      commissionDifference: updatedCreated.commissionDifference,
      matchCount: updatedCreated.matchCount,
    },
  )

  await recomputeDepositLineItemAllocations(tx, lineItemId, tenantId)
  await recomputeDepositAggregates(tx, depositId, tenantId)

  return {
    createdScheduleId: created.id,
    updatedBaseScheduleId: baseScheduleId,
  }
}

export async function executeFlexAdjustmentSplit(
  tx: PrismaClientOrTx,
  {
    tenantId,
    userId,
    depositId,
    lineItemId,
    baseScheduleId,
    splitUsage,
    splitCommission,
    varianceTolerance,
    request,
    reasonCode,
    classificationOverride,
  }: {
    tenantId: string
    userId: string
    depositId: string
    lineItemId: string
    baseScheduleId: string
    splitUsage: number
    splitCommission: number
    varianceTolerance: number
    request?: Request
    reasonCode: RevenueScheduleFlexReasonCode
    classificationOverride?: RevenueScheduleFlexClassification
  },
): Promise<FlexExecutionSummary> {
  const baseSchedule = await tx.revenueSchedule.findFirst({
    where: { tenantId, id: baseScheduleId },
    select: {
      id: true,
      tenantId: true,
      accountId: true,
      opportunityId: true,
      opportunityProductId: true,
      productId: true,
      distributorAccountId: true,
      vendorAccountId: true,
      scheduleDate: true,
      product: { select: { revenueType: true, productFamilyHouse: true, productNameHouse: true } },
    },
  })
  if (!baseSchedule) {
    throw new Error("Revenue schedule not found")
  }

  const family = normalizeLabel(baseSchedule.product?.productFamilyHouse)
  const name = normalizeLabel(baseSchedule.product?.productNameHouse)
  const isBonusLike =
    (typeof baseSchedule.product?.revenueType === "string" && baseSchedule.product.revenueType.startsWith("NRC_")) ||
    Boolean(family && /bonus|spiff|spf/i.test(family)) ||
    Boolean(name && /bonus|spiff|spf/i.test(name))

  const flexClassification = classificationOverride ?? (isBonusLike ? RevenueScheduleFlexClassification.Bonus : RevenueScheduleFlexClassification.Adjustment)
  const flexReasonCode = isBonusLike ? RevenueScheduleFlexReasonCode.BonusVariance : reasonCode

  const scheduleData = {
    accountId: baseSchedule.accountId,
    opportunityId: baseSchedule.opportunityId ?? null,
    opportunityProductId: baseSchedule.opportunityProductId ?? null,
    distributorAccountId: baseSchedule.distributorAccountId ?? null,
    vendorAccountId: baseSchedule.vendorAccountId ?? null,
    productId: baseSchedule.productId ?? null,
    scheduleDate: baseSchedule.scheduleDate ?? null,
    flexClassification,
    flexReasonCode,
    flexSourceDepositId: depositId,
    flexSourceDepositLineItemId: lineItemId,
  }

  const { createdScheduleId } = await applySplitMatchToNewSchedule(tx, {
    tenantId,
    userId,
    depositId,
    lineItemId,
    baseScheduleId,
    splitUsage,
    splitCommission,
    scheduleData,
    varianceTolerance,
    request,
  })

  return {
    applied: Boolean(createdScheduleId),
    action: "Adjust",
    createdRevenueScheduleIds: createdScheduleId ? [createdScheduleId] : [],
    createdProductIds: [],
  }
}

export async function executeFlexProductSplit(
  tx: PrismaClientOrTx,
  {
    tenantId,
    userId,
    depositId,
    lineItemId,
    baseScheduleId,
    splitUsage,
    splitCommission,
    varianceTolerance,
    request,
    reasonCode,
  }: {
    tenantId: string
    userId: string
    depositId: string
    lineItemId: string
    baseScheduleId: string
    splitUsage: number
    splitCommission: number
    varianceTolerance: number
    request?: Request
    reasonCode: RevenueScheduleFlexReasonCode
  },
): Promise<FlexExecutionSummary> {
  const baseSchedule = await tx.revenueSchedule.findFirst({
    where: { tenantId, id: baseScheduleId },
    select: {
      id: true,
      accountId: true,
      opportunityId: true,
      opportunityProductId: true,
      distributorAccountId: true,
      vendorAccountId: true,
      scheduleDate: true,
      product: { select: { revenueType: true, productNameVendor: true, productNameHouse: true } },
    },
  })
  if (!baseSchedule) {
    throw new Error("Revenue schedule not found")
  }

  const baseRevenueType = resolveRevenueType(baseSchedule.product?.revenueType)
  const productNameVendor =
    normalizeLabel(baseSchedule.product?.productNameVendor) ?? normalizeLabel(baseSchedule.product?.productNameHouse)

  const product = await createFlexProduct(tx, {
    tenantId,
    userId,
    accountId: baseSchedule.accountId,
    flexType: "FlexProduct",
    vendorAccountId: baseSchedule.vendorAccountId ?? null,
    distributorAccountId: baseSchedule.distributorAccountId ?? null,
    productNameVendor,
    productNameHouse: "Flex Product",
    revenueType: baseRevenueType,
  })

  const scheduleData = {
    accountId: baseSchedule.accountId,
    opportunityId: baseSchedule.opportunityId ?? null,
    opportunityProductId: baseSchedule.opportunityProductId ?? null,
    distributorAccountId: baseSchedule.distributorAccountId ?? null,
    vendorAccountId: baseSchedule.vendorAccountId ?? null,
    productId: product.id,
    scheduleDate: baseSchedule.scheduleDate ?? null,
    flexClassification: RevenueScheduleFlexClassification.FlexProduct,
    flexReasonCode: reasonCode,
    flexSourceDepositId: depositId,
    flexSourceDepositLineItemId: lineItemId,
  }

  const { createdScheduleId } = await applySplitMatchToNewSchedule(tx, {
    tenantId,
    userId,
    depositId,
    lineItemId,
    baseScheduleId,
    splitUsage,
    splitCommission,
    scheduleData,
    varianceTolerance,
    request,
  })

  return {
    applied: Boolean(createdScheduleId),
    action: "FlexProduct",
    createdRevenueScheduleIds: createdScheduleId ? [createdScheduleId] : [],
    createdProductIds: [product.id],
  }
}

export async function createFlexProductForUnknownLine(
  tx: PrismaClientOrTx,
  {
    tenantId,
    userId,
    depositId,
    lineItemId,
    varianceTolerance,
    request,
  }: {
    tenantId: string
    userId: string
    depositId: string
    lineItemId: string
    varianceTolerance: number
    request?: Request
  },
): Promise<FlexExecutionSummary> {
  const line = await tx.depositLineItem.findFirst({
    where: { tenantId, id: lineItemId, depositId },
    include: {
      deposit: { select: { accountId: true, distributorAccountId: true, vendorAccountId: true, month: true } },
    },
  })
  if (!line) {
    throw new Error("Deposit line item not found")
  }

  const existingMatches = await tx.depositLineMatch.count({
    where: { tenantId, depositLineItemId: lineItemId, status: DepositLineMatchStatus.Applied },
  })
  if (existingMatches > 0) {
    throw new Error("Line item already has allocations. Unmatch it before creating a flex product.")
  }

  const usage = toNumber(line.usage)
  const commission = toNumber(line.commission)

  const productNameVendor =
    normalizeLabel(line.productNameRaw) ?? normalizeLabel(line.vendorNameRaw) ?? "Unknown Product"

  const product = await createFlexProduct(tx, {
    tenantId,
    userId,
    accountId: line.deposit.accountId,
    flexType: "FlexProduct",
    vendorAccountId: line.vendorAccountId ?? line.deposit.vendorAccountId ?? null,
    distributorAccountId: line.deposit.distributorAccountId ?? null,
    productNameVendor,
    productNameHouse: "Flex Product",
    revenueType: "MRC_ThirdParty",
  })

  const schedule = await createFlexSchedule(tx, {
    tenantId,
    accountId: line.deposit.accountId,
    opportunityId: null,
    opportunityProductId: null,
    distributorAccountId: line.deposit.distributorAccountId ?? null,
    vendorAccountId: line.vendorAccountId ?? line.deposit.vendorAccountId ?? null,
    productId: product.id,
    scheduleDate: line.deposit.month ?? null,
    expectedUsage: usage,
    expectedCommission: commission,
    flexClassification: RevenueScheduleFlexClassification.FlexProduct,
    flexReasonCode: RevenueScheduleFlexReasonCode.UnknownProduct,
    flexSourceDepositId: depositId,
    flexSourceDepositLineItemId: lineItemId,
  })

  await tx.depositLineMatch.create({
    data: {
      tenantId,
      depositLineItemId: lineItemId,
      revenueScheduleId: schedule.id,
      usageAmount: usage,
      commissionAmount: commission,
      status: DepositLineMatchStatus.Applied,
      source: DepositLineMatchSource.Auto,
    },
  })

  await recomputeRevenueScheduleFromMatches(tx, schedule.id, tenantId, { varianceTolerance })
  await recomputeDepositLineItemAllocations(tx, lineItemId, tenantId)
  await recomputeDepositAggregates(tx, depositId, tenantId)

  await logRevenueScheduleAudit(
    AuditAction.Create,
    schedule.id,
    userId,
    tenantId,
    request,
    undefined,
    {
      action: "FlexCreateUnknownProduct",
      depositId,
      depositLineItemId: lineItemId,
      productId: product.id,
      expectedUsage: usage,
      expectedCommission: commission,
      flexClassification: RevenueScheduleFlexClassification.FlexProduct,
      flexReasonCode: RevenueScheduleFlexReasonCode.UnknownProduct,
    },
  )

  return {
    applied: true,
    action: "CreateFlexProduct",
    createdRevenueScheduleIds: [schedule.id],
    createdProductIds: [product.id],
  }
}

export async function createFlexChargebackForNegativeLine(
  tx: PrismaClientOrTx,
  {
    tenantId,
    userId,
    depositId,
    lineItemId,
    varianceTolerance,
    request,
  }: {
    tenantId: string
    userId: string
    depositId: string
    lineItemId: string
    varianceTolerance: number
    request?: Request
  },
): Promise<FlexExecutionSummary> {
  const line = await tx.depositLineItem.findFirst({
    where: { tenantId, id: lineItemId, depositId },
    include: { deposit: { select: { accountId: true, distributorAccountId: true, vendorAccountId: true, month: true } } },
  })
  if (!line) {
    throw new Error("Deposit line item not found")
  }

  const usage = toNumber(line.usage)
  const commission = toNumber(line.commission)

  if (usage >= 0 && commission >= 0) {
    throw new Error("Chargeback creation requires a negative usage or commission amount")
  }

  // Remove existing matches on this line to make the automation reversible via Unmatch.
  const existingMatches = await tx.depositLineMatch.findMany({
    where: { tenantId, depositLineItemId: lineItemId },
    select: { id: true, revenueScheduleId: true },
  })
  const scheduleIdsToRecompute = Array.from(
    new Set(existingMatches.map(match => match.revenueScheduleId).filter(Boolean)),
  )
  if (existingMatches.length > 0) {
    await tx.depositLineMatch.deleteMany({ where: { tenantId, depositLineItemId: lineItemId } })
  }

  for (const scheduleId of scheduleIdsToRecompute) {
    await recomputeRevenueScheduleFromMatches(tx, scheduleId, tenantId, { varianceTolerance })
  }

  const product = await createFlexProduct(tx, {
    tenantId,
    userId,
    accountId: line.deposit.accountId,
    flexType: "FlexChargeback",
    vendorAccountId: line.vendorAccountId ?? line.deposit.vendorAccountId ?? null,
    distributorAccountId: line.deposit.distributorAccountId ?? null,
    productNameVendor: "Chargeback",
    productNameHouse: "Flex Chargeback",
    revenueType: "NRC_FlatFee",
  })

  const schedule = await createFlexSchedule(tx, {
    tenantId,
    accountId: line.deposit.accountId,
    opportunityId: null,
    opportunityProductId: null,
    distributorAccountId: line.deposit.distributorAccountId ?? null,
    vendorAccountId: line.vendorAccountId ?? line.deposit.vendorAccountId ?? null,
    productId: product.id,
    scheduleDate: line.deposit.month ?? null,
    expectedUsage: usage,
    expectedCommission: commission,
    flexClassification: RevenueScheduleFlexClassification.FlexChargeback,
    flexReasonCode: RevenueScheduleFlexReasonCode.ChargebackNegative,
    flexSourceDepositId: depositId,
    flexSourceDepositLineItemId: lineItemId,
  })

  await tx.depositLineMatch.create({
    data: {
      tenantId,
      depositLineItemId: lineItemId,
      revenueScheduleId: schedule.id,
      usageAmount: usage,
      commissionAmount: commission,
      status: DepositLineMatchStatus.Applied,
      source: DepositLineMatchSource.Auto,
    },
  })

  await recomputeRevenueScheduleFromMatches(tx, schedule.id, tenantId, { varianceTolerance })
  await recomputeDepositLineItemAllocations(tx, lineItemId, tenantId)
  await recomputeDepositAggregates(tx, depositId, tenantId)

  await logRevenueScheduleAudit(
    AuditAction.Create,
    schedule.id,
    userId,
    tenantId,
    request,
    undefined,
    {
      action: "FlexCreateChargeback",
      depositId,
      depositLineItemId: lineItemId,
      productId: product.id,
      expectedUsage: usage,
      expectedCommission: commission,
      flexClassification: RevenueScheduleFlexClassification.FlexChargeback,
      flexReasonCode: RevenueScheduleFlexReasonCode.ChargebackNegative,
    },
  )

  return {
    applied: true,
    action: "AutoChargeback",
    createdRevenueScheduleIds: [schedule.id],
    createdProductIds: [product.id],
  }
}
