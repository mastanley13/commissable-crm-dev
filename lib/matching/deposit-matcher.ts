import { Prisma, DepositLineItemStatus, DepositLineMatchStatus } from "@prisma/client"
import type { SuggestedMatchScheduleRow } from "@/lib/mock-data"
import { prisma } from "@/lib/db"

type DepositLineWithRelations = Awaited<ReturnType<typeof fetchDepositLine>>
type RevenueScheduleWithRelations = Awaited<ReturnType<typeof fetchCandidateSchedules>>[number]

interface CandidateSignal {
  id: string
  score: number
  weight: number
  contribution: number
  description?: string
}

export interface ScoredCandidate {
  revenueScheduleId: string
  revenueScheduleName: string
  revenueScheduleDate: string | null
  accountName: string | null
  accountLegalName: string | null
  vendorName: string | null
  productNameVendor: string | null
  matchConfidence: number
  confidenceLevel: "high" | "medium" | "low"
  expectedUsage: number
  expectedUsageAdjustment: number
  actualUsage: number
  actualUsageAdjustment: number
  expectedCommission: number
  expectedCommissionAdjustment: number
  actualCommission: number
  actualCommissionAdjustment: number
  usageBalance: number
  commissionDifference: number
  signals: CandidateSignal[]
  reasons: string[]
}

export interface MatchDepositLineResult {
  lineItem: NonNullable<DepositLineWithRelations>
  appliedMatchScheduleId?: string
  candidates: ScoredCandidate[]
}

interface MatchOptions {
  limit?: number
  dateWindowMonths?: number
}

const DEFAULT_RESULT_LIMIT = 5
const DEFAULT_UNIVERSE_LIMIT = 30
const DEFAULT_DATE_WINDOW_MONTHS = 1

const thresholds = {
  autoMatchThreshold: 0.97,
  suggestThreshold: 0.9,
  mediumThreshold: 0.75,
}

export async function matchDepositLine(
  depositLineItemId: string,
  options: MatchOptions = {},
): Promise<MatchDepositLineResult> {
  const lineItem = await fetchDepositLine(depositLineItemId)
  if (!lineItem) {
    throw new Error(`Deposit line item ${depositLineItemId} not found`)
  }

  const resultLimit = options.limit ?? DEFAULT_RESULT_LIMIT
  const searchLimit = Math.max(resultLimit * 3, DEFAULT_UNIVERSE_LIMIT)

  const candidates = await fetchCandidateSchedules(lineItem, {
    dateWindowMonths: options.dateWindowMonths ?? DEFAULT_DATE_WINDOW_MONTHS,
    take: searchLimit,
  })

  const scored = candidates
    .map(schedule => scoreCandidate(lineItem, schedule))
    .sort((a, b) => b.matchConfidence - a.matchConfidence)
    .slice(0, resultLimit)

  const appliedMatchScheduleId = lineItem.matches.find(
    (match) => match.status === DepositLineMatchStatus.Applied,
  )?.revenueScheduleId

  return {
    lineItem,
    appliedMatchScheduleId,
    candidates: scored,
  }
}

type SuggestedRowWithSignals = SuggestedMatchScheduleRow & {
  signals: CandidateSignal[]
  reasons: string[]
  confidenceLevel: "high" | "medium" | "low"
}

export function candidatesToSuggestedRows(
  lineItem: NonNullable<DepositLineWithRelations>,
  candidates: ScoredCandidate[],
  appliedScheduleId?: string | null,
): SuggestedRowWithSignals[] {
  return candidates.map(candidate => {
    const expectedUsageNet = candidate.expectedUsage + candidate.expectedUsageAdjustment
    const actualUsageNet = candidate.actualUsage + candidate.actualUsageAdjustment
    const expectedCommissionNet =
      candidate.expectedCommission + candidate.expectedCommissionAdjustment
    const actualCommissionNet = candidate.actualCommission + candidate.actualCommissionAdjustment

    const expectedCommissionRate =
      expectedUsageNet !== 0 ? expectedCommissionNet / expectedUsageNet : 0
    const actualCommissionRate = actualUsageNet !== 0 ? actualCommissionNet / actualUsageNet : 0

    return {
      id: candidate.revenueScheduleId,
      status: appliedScheduleId === candidate.revenueScheduleId ? "Reconciled" : "Suggested",
      lineItem: lineItem.lineNumber ?? 0,
      matchConfidence: candidate.matchConfidence,
      vendorName: candidate.vendorName ?? "",
      legalName: candidate.accountLegalName ?? candidate.accountName ?? "",
      productNameVendor: candidate.productNameVendor ?? "",
      revenueScheduleDate: candidate.revenueScheduleDate ?? "",
      revenueScheduleName: candidate.revenueScheduleName,
      quantity: 1,
      priceEach: candidate.expectedUsage,
      expectedUsageGross: candidate.expectedUsage,
      expectedUsageAdjustment: candidate.expectedUsageAdjustment,
      expectedUsageNet,
      actualUsage: actualUsageNet,
      usageBalance: expectedUsageNet - actualUsageNet,
      paymentDate: candidate.revenueScheduleDate ?? "",
      expectedCommissionGross: candidate.expectedCommission,
      expectedCommissionAdjustment: candidate.expectedCommissionAdjustment,
      expectedCommissionNet,
      actualCommission: actualCommissionNet,
      commissionDifference: expectedCommissionNet - actualCommissionNet,
      expectedCommissionRatePercent: expectedCommissionRate,
      actualCommissionRatePercent: actualCommissionRate,
      commissionRateDifference: expectedCommissionRate - actualCommissionRate,
      signals: candidate.signals,
      reasons: candidate.reasons,
      confidenceLevel: candidate.confidenceLevel,
    }
  })
}

async function fetchDepositLine(depositLineItemId: string) {
  return prisma.depositLineItem.findUnique({
    where: { id: depositLineItemId },
    include: {
      deposit: {
        select: {
          id: true,
          tenantId: true,
          paymentDate: true,
          month: true,
          distributorAccountId: true,
          vendorAccountId: true,
        },
      },
      account: { select: { accountName: true } },
      vendorAccount: { select: { accountName: true } },
      product: { select: { productNameVendor: true, productNameHouse: true } },
      matches: { select: { revenueScheduleId: true, status: true } },
    },
  })
}

async function fetchCandidateSchedules(
  lineItem: NonNullable<DepositLineWithRelations>,
  options: { dateWindowMonths: number; take: number },
) {
  const referenceDate =
    lineItem.paymentDate ?? lineItem.deposit?.paymentDate ?? lineItem.deposit?.month ?? new Date()
  const fromDate = addMonths(referenceDate, -options.dateWindowMonths)
  const toDate = addMonths(referenceDate, options.dateWindowMonths)

  const strictFilters: Prisma.RevenueScheduleWhereInput[] = [
    { scheduleDate: { gte: fromDate, lte: toDate } },
  ]
  if (lineItem.deposit?.distributorAccountId) {
    strictFilters.push({ distributorAccountId: lineItem.deposit.distributorAccountId })
  }
  if (lineItem.deposit?.vendorAccountId) {
    strictFilters.push({ vendorAccountId: lineItem.deposit.vendorAccountId })
  }
  if (lineItem.accountId) {
    strictFilters.push({ accountId: lineItem.accountId })
  }

  const baseWhere: Prisma.RevenueScheduleWhereInput = {
    tenantId: lineItem.tenantId,
    AND: strictFilters,
  }

  const commonInclude = {
    account: { select: { accountName: true, accountLegalName: true } },
    vendor: { select: { accountName: true } },
    product: { select: { productNameVendor: true, productNameHouse: true } },
    opportunity: {
      select: {
        customerIdVendor: true,
        orderIdVendor: true,
        distributorName: true,
        vendorName: true,
      },
    },
  } satisfies Prisma.RevenueScheduleInclude

  let schedules = await prisma.revenueSchedule.findMany({
    where: baseWhere,
    orderBy: [
      { scheduleDate: "asc" },
      { createdAt: "asc" },
    ],
    include: commonInclude,
    take: options.take,
  })

  if (schedules.length === 0) {
    schedules = await prisma.revenueSchedule.findMany({
      where: {
        tenantId: lineItem.tenantId,
        scheduleDate: { gte: fromDate, lte: toDate },
      },
      orderBy: [
        { scheduleDate: "asc" },
        { createdAt: "asc" },
      ],
      include: commonInclude,
      take: options.take,
    })
  }

  return schedules
}

function scoreCandidate(
  lineItem: NonNullable<DepositLineWithRelations>,
  schedule: RevenueScheduleWithRelations,
): ScoredCandidate {
  const lineUsage = toNumber(lineItem.usage)
  const lineCommission = toNumber(lineItem.commission)

  const expectedUsage = toNumber(schedule.expectedUsage)
  const expectedUsageAdjustment = toNumber(schedule.usageAdjustment)
  const actualUsage = toNumber(schedule.actualUsage)
  const actualUsageAdjustment = toNumber(schedule.actualUsageAdjustment)
  const expectedUsageNet = expectedUsage + expectedUsageAdjustment
  const actualUsageNet = actualUsage + actualUsageAdjustment

  const expectedCommission = toNumber(schedule.expectedCommission)
  const expectedCommissionAdjustment = 0
  const actualCommission = toNumber(schedule.actualCommission)
  const actualCommissionAdjustment = toNumber(schedule.actualCommissionAdjustment)
  const expectedCommissionNet = expectedCommission + expectedCommissionAdjustment
  const actualCommissionNet = actualCommission + actualCommissionAdjustment

  const signals: CandidateSignal[] = []

  const vendorAccountMatch =
    cleanId(lineItem.vendorAccountId) !== null &&
    cleanId(schedule.vendorAccountId) === cleanId(lineItem.vendorAccountId)
  signals.push(
    buildBooleanSignal("vendor_account_exact", vendorAccountMatch, 0.18, "Vendor account matches"),
  )

  const accountIdMatch =
    cleanId(lineItem.accountId) !== null && cleanId(schedule.accountId) === cleanId(lineItem.accountId)
  signals.push(
    buildBooleanSignal("account_exact", accountIdMatch, 0.22, "Customer account matches"),
  )

  const customerIdMatch =
    cleanId(lineItem.customerIdVendor) !== null &&
    cleanId(schedule.opportunity?.customerIdVendor) === cleanId(lineItem.customerIdVendor)
  signals.push(
    buildBooleanSignal("customer_id_exact", customerIdMatch, 0.12, "Customer/vendor ID matches"),
  )

  const orderIdMatch = hasOrderIdMatch(lineItem.orderIdVendor, schedule)
  signals.push(
    buildBooleanSignal("order_id_exact", orderIdMatch, 0.12, "Order ID matches"),
  )

  const accountNameSimilarity = computeNameSimilarity(
    normalizeName(lineItem.accountNameRaw ?? lineItem.account?.accountName ?? ""),
    normalizeName(
      schedule.account?.accountName ??
        schedule.account?.accountLegalName ??
        schedule.opportunity?.distributorName ??
        "",
    ),
  )
  signals.push(
    buildSimilaritySignal(
      "account_name_similarity",
      accountNameSimilarity,
      0.12,
      "Account/distributor name similarity",
    ),
  )

  const productSimilarity = computeNameSimilarity(
    normalizeName(lineItem.productNameRaw ?? lineItem.product?.productNameVendor ?? ""),
    normalizeName(schedule.product?.productNameVendor ?? schedule.product?.productNameHouse ?? ""),
  )
  signals.push(
    buildSimilaritySignal("product_similarity", productSimilarity, 0.08, "Product name similarity"),
  )

  const amountSignal = amountProximity(lineUsage, expectedUsageNet)
  signals.push(
    buildSimilaritySignal("usage_amount", amountSignal, 0.08, "Usage amount proximity"),
  )

  const commissionSignal = amountProximity(lineCommission, expectedCommissionNet)
  signals.push(
    buildSimilaritySignal(
      "commission_amount",
      commissionSignal,
      0.05,
      "Commission amount proximity",
    ),
  )

  const dateSignal = dateProximity(
    lineItem.paymentDate ?? lineItem.deposit?.paymentDate ?? lineItem.deposit?.month ?? null,
    schedule.scheduleDate ?? null,
  )
  signals.push(buildSimilaritySignal("date_proximity", dateSignal, 0.03, "Dates are close"))

  const weightedScore = signals.reduce((acc, signal) => acc + signal.contribution, 0)
  const matchConfidence = Number(Math.min(weightedScore, 1).toFixed(4))
  const confidenceLevel = classifyConfidence(matchConfidence)

  const reasons = signals
    .filter(signal => signal.score > 0)
    .map(signal => signal.description || signal.id)

  return {
    revenueScheduleId: schedule.id,
    revenueScheduleName: schedule.scheduleNumber ?? schedule.id,
    revenueScheduleDate: schedule.scheduleDate?.toISOString() ?? null,
    accountName: schedule.account?.accountName ?? null,
    accountLegalName: schedule.account?.accountLegalName ?? null,
    vendorName: schedule.vendor?.accountName ?? schedule.opportunity?.vendorName ?? null,
    productNameVendor: schedule.product?.productNameVendor ?? schedule.product?.productNameHouse ?? null,
    matchConfidence,
    confidenceLevel,
    expectedUsage,
    expectedUsageAdjustment,
    actualUsage,
    actualUsageAdjustment,
    expectedCommission,
    expectedCommissionAdjustment,
    actualCommission,
    actualCommissionAdjustment,
    usageBalance: expectedUsageNet - actualUsageNet,
    commissionDifference: expectedCommissionNet - actualCommissionNet,
    signals,
    reasons,
  }
}

function hasOrderIdMatch(orderId: string | null | undefined, schedule: RevenueScheduleWithRelations) {
  const cleanOrder = cleanId(orderId)
  if (!cleanOrder) return false
  return (
    cleanId(schedule.orderIdHouse) === cleanOrder ||
    cleanId(schedule.distributorOrderId) === cleanOrder ||
    cleanId(schedule.opportunity?.orderIdVendor) === cleanOrder
  )
}

function buildBooleanSignal(
  id: string,
  matched: boolean,
  weight: number,
  description?: string,
): CandidateSignal {
  const score = matched ? 1 : 0
  return {
    id,
    score,
    weight,
    contribution: score * weight,
    description,
  }
}

function buildSimilaritySignal(
  id: string,
  similarity: number,
  weight: number,
  description?: string,
): CandidateSignal {
  const bounded = Math.max(0, Math.min(similarity, 1))
  return {
    id,
    score: bounded,
    weight,
    contribution: bounded * weight,
    description,
  }
}

function computeNameSimilarity(a: string, b: string) {
  const normA = normalizeName(a)
  const normB = normalizeName(b)
  if (!normA.length || !normB.length) return 0
  if (normA === normB) return 1

  const tokensA = new Set(normA.split(/\s+/).filter(Boolean))
  const tokensB = new Set(normB.split(/\s+/).filter(Boolean))
  if (!tokensA.size || !tokensB.size) return 0

  let intersection = 0
  tokensA.forEach(token => {
    if (tokensB.has(token)) intersection++
  })
  const denominator = Math.max(tokensA.size, tokensB.size)
  return intersection / denominator
}

function amountProximity(lineAmount: number, expectedAmount: number) {
  if (lineAmount === 0 || expectedAmount === 0) return 0
  const variance = Math.abs(lineAmount - expectedAmount) / Math.max(Math.abs(lineAmount), Math.abs(expectedAmount))
  return Math.max(0, Math.min(1, 1 - variance))
}

function dateProximity(lineDate: Date | null, scheduleDate: Date | null) {
  const line = normalizeDate(lineDate)
  const schedule = normalizeDate(scheduleDate)
  if (!line || !schedule) return 0
  const diffMs = Math.abs(line.getTime() - schedule.getTime())
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  if (diffDays >= 90) return 0
  return Math.max(0, Math.min(1, (90 - diffDays) / 90))
}

function classifyConfidence(score: number): "high" | "medium" | "low" {
  if (score >= thresholds.suggestThreshold) return "high"
  if (score >= thresholds.mediumThreshold) return "medium"
  return "low"
}

function normalizeName(value: string) {
  const cleaned = value
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
  return stripLegalSuffixes(cleaned)
}

function stripLegalSuffixes(value: string) {
  return value.replace(/\b(LLC|L\.L\.C|INC|INCORPORATED|CORP|CORPORATION|CO|CO\.|LTD)\b/gi, "").trim()
}

function cleanId(value: string | null | undefined) {
  if (!value) return null
  const cleaned = value.trim()
  if (!cleaned || /^null$/i.test(cleaned) || /^n\/a$/i.test(cleaned)) return null
  return cleaned.toUpperCase()
}

function toNumber(value: unknown) {
  const numeric = Number(value ?? 0)
  return Number.isFinite(numeric) ? numeric : 0
}

function normalizeDate(value: Date | string | null) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  // normalize to date-only to avoid tz drift
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function addMonths(date: Date, months: number) {
  const result = new Date(date)
  result.setMonth(result.getMonth() + months)
  return result
}
