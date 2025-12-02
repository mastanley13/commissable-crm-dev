import { Prisma, DepositLineItemStatus } from "@prisma/client"
import { prisma } from "@/lib/db"

export interface DepositMatchCandidate {
  revenueScheduleId: string
  revenueScheduleName: string
  revenueScheduleDate: string | null
  accountName: string | null
  vendorName: string | null
  productNameVendor: string | null
  matchConfidence: number
  expectedUsage: number
  actualUsage: number
  expectedCommission: number
  actualCommission: number
  usageBalance: number
  commissionDifference: number
  signals: {
    accountIdMatch: boolean
    orderIdMatch: boolean
    nameSimilarity: number
    amountVariance: number
  }
}

export interface DepositLineMatchContext {
  lineItem: Awaited<ReturnType<typeof fetchDepositLine>>
  candidates: DepositMatchCandidate[]
}

interface MatchOptions {
  limit?: number
  dateWindowMonths?: number
}

export async function matchDepositLine(
  depositLineItemId: string,
  options: MatchOptions = {},
): Promise<DepositLineMatchContext> {
  const lineItem = await fetchDepositLine(depositLineItemId)
  if (!lineItem) {
    throw new Error(`Deposit line item ${depositLineItemId} not found`)
  }

  const candidates = await fetchCandidateSchedules(lineItem, {
    limit: options.limit ?? 15,
    dateWindowMonths: options.dateWindowMonths ?? 1,
  })

  return {
    lineItem,
    candidates,
  }
}

async function fetchDepositLine(depositLineItemId: string) {
  return prisma.depositLineItem.findUnique({
    where: { id: depositLineItemId },
    include: {
      deposit: true,
      account: { select: { accountName: true } },
      vendorAccount: { select: { accountName: true } },
      product: { select: { productNameVendor: true } },
    },
  })
}

async function fetchCandidateSchedules(lineItem: NonNullable<Awaited<ReturnType<typeof fetchDepositLine>>>, options: Required<MatchOptions>) {
  const referenceDate = lineItem.paymentDate ?? lineItem.deposit?.paymentDate ?? lineItem.deposit?.month ?? new Date()
  const fromDate = addMonths(referenceDate, -options.dateWindowMonths)
  const toDate = addMonths(referenceDate, options.dateWindowMonths)

  const where: Prisma.RevenueScheduleWhereInput = {
    tenantId: lineItem.tenantId,
    scheduleDate: {
      gte: fromDate,
      lte: toDate,
    },
  }

  const schedules = await prisma.revenueSchedule.findMany({
    where,
    orderBy: [
      { scheduleDate: "asc" },
      { createdAt: "asc" },
    ],
    include: {
      account: { select: { accountName: true } },
      vendor: { select: { accountName: true } },
      product: { select: { productNameVendor: true } },
    },
    take: options.limit,
  })

  const lineUsage = Number(lineItem.usage ?? 0)
  const lineCommission = Number(lineItem.commission ?? 0)

  const scored = schedules.map(schedule => {
    const expectedUsage = Number(schedule.expectedUsage ?? 0)
    const actualUsage = Number(schedule.actualUsage ?? 0)
    const usageBalance = expectedUsage - actualUsage

    const expectedCommission = Number(schedule.expectedCommission ?? 0)
    const actualCommission = Number(schedule.actualCommission ?? 0)
    const commissionDifference = expectedCommission - actualCommission

    const accountIdMatch = Boolean(lineItem.accountId && schedule.accountId === lineItem.accountId)
    const orderIdMatch =
      Boolean(lineItem.orderIdVendor &&
        (schedule.orderIdHouse === lineItem.orderIdVendor ||
          schedule.distributorOrderId === lineItem.orderIdVendor))

    const nameSimilarity = computeNameSimilarity(
      lineItem.accountNameRaw ?? "",
      schedule.account?.accountName ?? "",
    )
    const productSimilarity = computeNameSimilarity(
      lineItem.productNameRaw ?? "",
      schedule.product?.productNameVendor ?? "",
    )

    const amountVariance = computeAmountVariance(lineUsage, expectedUsage)
    const commissionVariance = computeAmountVariance(lineCommission, expectedCommission)

    const confidence = computeConfidence({
      accountIdMatch,
      orderIdMatch,
      nameSimilarity,
      productSimilarity,
      amountVariance,
      commissionVariance,
      status: lineItem.status,
    })

    return {
      revenueScheduleId: schedule.id,
      revenueScheduleName: schedule.scheduleNumber ?? schedule.id,
      revenueScheduleDate: schedule.scheduleDate?.toISOString() ?? null,
      accountName: schedule.account?.accountName ?? null,
      vendorName: schedule.vendor?.accountName ?? null,
      productNameVendor: schedule.product?.productNameVendor ?? null,
      matchConfidence: confidence,
      expectedUsage,
      actualUsage,
      expectedCommission,
      actualCommission,
      usageBalance,
      commissionDifference,
      signals: {
        accountIdMatch,
        orderIdMatch,
        nameSimilarity,
        amountVariance,
      },
    } as DepositMatchCandidate
  })

  return scored.sort((a, b) => b.matchConfidence - a.matchConfidence)
}

function computeNameSimilarity(a: string, b: string) {
  const normA = normalizeText(a)
  const normB = normalizeText(b)
  if (!normA.length || !normB.length) return 0
  if (normA === normB) return 1

  const tokensA = new Set(normA.split(/\s+/).filter(Boolean))
  const tokensB = new Set(normB.split(/\s+/).filter(Boolean))
  if (!tokensA.size || !tokensB.size) return 0

  let intersection = 0
  for (const token of tokensA) {
    if (tokensB.has(token)) intersection++
  }
  const denominator = Math.max(tokensA.size, tokensB.size)
  return intersection / denominator
}

function computeAmountVariance(lineAmount: number, expectedAmount: number) {
  if (lineAmount === 0 || expectedAmount === 0) return 1
  return Math.min(Math.abs(lineAmount - expectedAmount) / Math.max(lineAmount, expectedAmount), 1)
}

function computeConfidence({
  accountIdMatch,
  orderIdMatch,
  nameSimilarity,
  productSimilarity,
  amountVariance,
  commissionVariance,
  status,
}: {
  accountIdMatch: boolean
  orderIdMatch: boolean
  nameSimilarity: number
  productSimilarity: number
  amountVariance: number
  commissionVariance: number
  status: DepositLineItemStatus
}) {
  let score = 0
  if (accountIdMatch) score += 0.35
  if (orderIdMatch) score += 0.2
  score += nameSimilarity * 0.2
  score += productSimilarity * 0.1
  score += (1 - amountVariance) * 0.1
  score += (1 - commissionVariance) * 0.05

  if (status === DepositLineItemStatus.Matched) {
    score = Math.min(score + 0.05, 1)
  }

  return Number(Math.min(score, 1).toFixed(4))
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function addMonths(date: Date, months: number) {
  const result = new Date(date)
  result.setMonth(result.getMonth() + months)
  return result
}
