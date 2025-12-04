import { Prisma, DepositLineMatchStatus, RevenueScheduleStatus } from "@prisma/client"
import type { SuggestedMatchScheduleRow } from "@/lib/mock-data"
import { prisma } from "@/lib/db"

type DepositLineWithRelations = Awaited<ReturnType<typeof fetchDepositLine>>
const candidateScheduleInclude = {
  account: { select: { accountName: true, accountLegalName: true } },
  vendor: { select: { accountName: true } },
  product: {
    select: {
      productNameVendor: true,
      productNameHouse: true,
      partNumberVendor: true,
      partNumberHouse: true,
      partNumberDistributor: true,
    },
  },
  opportunity: {
    select: {
      customerIdVendor: true,
      customerIdHouse: true,
      customerIdDistributor: true,
      orderIdVendor: true,
      orderIdHouse: true,
      orderIdDistributor: true,
      distributorName: true,
      vendorName: true,
    },
  },
} satisfies Prisma.RevenueScheduleInclude

type RevenueScheduleWithRelations = Prisma.RevenueScheduleGetPayload<{
  include: typeof candidateScheduleInclude
}> & {
  __isFallback?: boolean
}

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
  createdAt?: string
  accountName: string | null
  accountLegalName: string | null
  vendorName: string | null
  productNameVendor: string | null
  matchConfidence: number
  matchType: "exact" | "fuzzy" | "legacy"
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
  includeFutureSchedules?: boolean
  useHierarchicalMatching?: boolean
  varianceTolerance?: number
  allowCrossVendorFallback?: boolean
  debugLog?: boolean
}

const DEFAULT_RESULT_LIMIT = 5
const DEFAULT_UNIVERSE_LIMIT = 30
const DEFAULT_DATE_WINDOW_MONTHS = 1
const DEFAULT_VARIANCE_TOLERANCE = 0
const CROSS_VENDOR_CONFIDENCE_CAP = 0.6
const PASS_B_MIN_CONFIDENCE = 0.5
const STRONG_ID_CONFLICT_CAP = 0.7

const thresholds = {
  autoMatchThreshold: 0.97,
  suggestThreshold: 0.9,
  mediumThreshold: 0.75,
}

function isHierarchicalMatchingEnabledByEnv() {
  const raw =
    process.env.HIERARCHICAL_MATCHING_ENABLED ??
    process.env.NEXT_PUBLIC_HIERARCHICAL_MATCHING ??
    ""
  return raw.toLowerCase() === "true" || raw === "1"
}

function isMatchingDebugEnabled() {
  const raw =
    process.env.MATCHING_DEBUG_LOG ??
    process.env.HIERARCHICAL_MATCHING_DEBUG ??
    process.env.NEXT_PUBLIC_MATCHING_DEBUG_LOG ??
    ""
  return raw.toLowerCase() === "true" || raw === "1"
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
  const useHierarchical =
    options.useHierarchicalMatching ?? isHierarchicalMatchingEnabledByEnv()
  const includeFutureSchedules = options.includeFutureSchedules ?? false
  const allowCrossVendorFallback = options.allowCrossVendorFallback ?? false
  const varianceTolerance = options.varianceTolerance ?? DEFAULT_VARIANCE_TOLERANCE

  const candidates = await fetchCandidateSchedules(lineItem, {
    dateWindowMonths: options.dateWindowMonths ?? DEFAULT_DATE_WINDOW_MONTHS,
    take: searchLimit,
    includeFutureSchedules,
    allowCrossVendorFallback,
  })

  const appliedMatchScheduleId = lineItem.matches.find(
    (match) => match.status === DepositLineMatchStatus.Applied,
  )?.revenueScheduleId

  const scored = useHierarchical
    ? runHierarchicalScoring(lineItem, candidates, {
      limit: resultLimit,
      varianceTolerance,
    })
    : runLegacyScoring(lineItem, candidates, { limit: resultLimit })

  if (options.debugLog ?? isMatchingDebugEnabled()) {
    logCandidatesDebug(lineItem.id, scored)
  }

  return {
    lineItem,
    appliedMatchScheduleId,
    candidates: scored,
  }
}

function computeProductIdentitySimilarity(
  lineItem: NonNullable<DepositLineWithRelations>,
  schedule: RevenueScheduleWithRelations,
) {
  const lineProductName =
    lineItem.productNameRaw ??
    lineItem.product?.productNameVendor ??
    lineItem.product?.productNameHouse ??
    ""
  const scheduleProductName =
    schedule.product?.productNameVendor ?? schedule.product?.productNameHouse ?? ""
  const productNameSim = computeNameSimilarity(lineProductName, scheduleProductName)

  const linePartNumber =
    lineItem.product?.partNumberVendor ??
    lineItem.product?.partNumberHouse ??
    lineItem.product?.partNumberDistributor ??
    ""
  const schedulePartNumber =
    schedule.product?.partNumberVendor ??
    schedule.product?.partNumberHouse ??
    schedule.product?.partNumberDistributor ??
    ""
  const partNumberSim = computeNameSimilarity(linePartNumber, schedulePartNumber)

  return Math.max(productNameSim, partNumberSim)
}

function checkAccountLegalExact(
  lineItem: NonNullable<DepositLineWithRelations>,
  schedule: RevenueScheduleWithRelations,
) {
  const lineName = normalizeName(
    lineItem.accountNameRaw ?? lineItem.account?.accountLegalName ?? lineItem.account?.accountName ?? "",
  )
  const scheduleName = normalizeName(
    schedule.account?.accountLegalName ?? schedule.account?.accountName ?? "",
  )
  return Boolean(lineName && scheduleName && lineName === scheduleName)
}

function checkCustomerIdExact(
  lineItem: NonNullable<DepositLineWithRelations>,
  schedule: RevenueScheduleWithRelations,
) {
  const lineId = cleanId(lineItem.customerIdVendor)
  if (!lineId) return false
  const scheduleIds = [
    schedule.opportunity?.customerIdVendor,
    schedule.opportunity?.customerIdHouse,
    schedule.opportunity?.customerIdDistributor,
  ]
    .map(cleanId)
    .filter(Boolean)
  return scheduleIds.includes(lineId)
}

function checkAccountIdExact(
  lineItem: NonNullable<DepositLineWithRelations>,
  schedule: RevenueScheduleWithRelations,
) {
  const lineAccountId = cleanId(lineItem.accountId)
  const scheduleAccountId = cleanId(schedule.accountId)
  return Boolean(lineAccountId && scheduleAccountId && lineAccountId === scheduleAccountId)
}

function hasStrongIdConflict(
  lineItem: NonNullable<DepositLineWithRelations>,
  schedule: RevenueScheduleWithRelations,
) {
  const orderId = cleanId(lineItem.orderIdVendor)
  const scheduleHasAnyOrder =
    cleanId(schedule.orderIdHouse) ||
    cleanId(schedule.distributorOrderId) ||
    cleanId(schedule.opportunity?.orderIdVendor)

  if (orderId && scheduleHasAnyOrder && !hasOrderIdMatch(lineItem.orderIdVendor, schedule)) {
    return true
  }

  const customerId = cleanId(lineItem.customerIdVendor)
  const scheduleCustomerIds = [
    schedule.opportunity?.customerIdVendor,
    schedule.opportunity?.customerIdHouse,
    schedule.opportunity?.customerIdDistributor,
  ]
    .map(cleanId)
    .filter(Boolean)

  if (customerId && scheduleCustomerIds.length && !scheduleCustomerIds.includes(customerId)) {
    return true
  }

  const accountId = cleanId(lineItem.accountId)
  const scheduleAccountId = cleanId(schedule.accountId)
  if (accountId && scheduleAccountId && accountId !== scheduleAccountId) {
    return true
  }

  return false
}

function sortCandidatesWithFIFO(candidates: ScoredCandidate[]): ScoredCandidate[] {
  return candidates.sort((a, b) => {
    if (b.matchConfidence !== a.matchConfidence) {
      return b.matchConfidence - a.matchConfidence
    }

    const dateA = a.revenueScheduleDate ? new Date(a.revenueScheduleDate).getTime() : Infinity
    const dateB = b.revenueScheduleDate ? new Date(b.revenueScheduleDate).getTime() : Infinity
    if (dateA !== dateB) {
      return dateA - dateB
    }

    const createdA = a.createdAt ? new Date(a.createdAt).getTime() : Infinity
    const createdB = b.createdAt ? new Date(b.createdAt).getTime() : Infinity
    return createdA - createdB
  })
}

function getLinePaymentDate(lineItem: NonNullable<DepositLineWithRelations>) {
  return lineItem.paymentDate ?? lineItem.deposit?.paymentDate ?? lineItem.deposit?.month ?? null
}

function getReferenceDate(lineItem: NonNullable<DepositLineWithRelations>) {
  return getLinePaymentDate(lineItem) ?? new Date()
}

function runLegacyScoring(
  lineItem: NonNullable<DepositLineWithRelations>,
  schedules: RevenueScheduleWithRelations[],
  { limit }: { limit: number },
) {
  const scored = schedules.map(schedule => scoreCandidateLegacy(lineItem, schedule))
  return sortCandidatesWithFIFO(scored).slice(0, limit)
}

function runHierarchicalScoring(
  lineItem: NonNullable<DepositLineWithRelations>,
  schedules: RevenueScheduleWithRelations[],
  { limit, varianceTolerance }: { limit: number; varianceTolerance: number },
) {
  const tolerance = Math.max(0, Math.min(varianceTolerance, 1))
  const passA = schedules
    .map(schedule => buildPassACandidate(lineItem, schedule, tolerance))
    .filter((candidate): candidate is ScoredCandidate => Boolean(candidate))

  const passAIds = new Set(passA.map(candidate => candidate.revenueScheduleId))

  const passB = schedules
    .map(schedule => scoreCandidatePassB(lineItem, schedule))
    .filter((candidate): candidate is ScoredCandidate => Boolean(candidate))
    .filter(candidate => {
      if (passAIds.has(candidate.revenueScheduleId)) return false
      return candidate.matchConfidence >= PASS_B_MIN_CONFIDENCE
    })

  const combined = [...passA, ...passB]
  if (!combined.length) return []

  return sortCandidatesWithFIFO(combined).slice(0, limit)
}

type ScheduleMetrics = {
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
}

function computeScheduleMetrics(schedule: RevenueScheduleWithRelations): ScheduleMetrics {
  const expectedUsage = toNumber(schedule.expectedUsage)
  const expectedUsageAdjustment = toNumber(schedule.usageAdjustment)
  const actualUsage = toNumber(schedule.actualUsage)
  const actualUsageAdjustment = toNumber(schedule.actualUsageAdjustment)

  const expectedCommission = toNumber(schedule.expectedCommission)
  const expectedCommissionAdjustment = 0
  const actualCommission = toNumber(schedule.actualCommission)
  const actualCommissionAdjustment = toNumber(schedule.actualCommissionAdjustment)

  const expectedUsageNet = expectedUsage + expectedUsageAdjustment
  const actualUsageNet = actualUsage + actualUsageAdjustment
  const expectedCommissionNet = expectedCommission + expectedCommissionAdjustment
  const actualCommissionNet = actualCommission + actualCommissionAdjustment

  return {
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
  }
}

function computeCommissionDifference(schedule: RevenueScheduleWithRelations) {
  return computeScheduleMetrics(schedule).commissionDifference
}

function buildCandidateBase(
  lineItem: NonNullable<DepositLineWithRelations>,
  schedule: RevenueScheduleWithRelations,
  metrics?: ScheduleMetrics,
) {
  const computedMetrics = metrics ?? computeScheduleMetrics(schedule)
  return {
    revenueScheduleId: schedule.id,
    revenueScheduleName: schedule.scheduleNumber ?? schedule.id,
    revenueScheduleDate: schedule.scheduleDate?.toISOString() ?? null,
    createdAt: schedule.createdAt?.toISOString(),
    accountName: schedule.account?.accountName ?? null,
    accountLegalName: schedule.account?.accountLegalName ?? null,
    vendorName: schedule.vendor?.accountName ?? schedule.opportunity?.vendorName ?? null,
    productNameVendor: schedule.product?.productNameVendor ?? schedule.product?.productNameHouse ?? null,
    expectedUsage: computedMetrics.expectedUsage,
    expectedUsageAdjustment: computedMetrics.expectedUsageAdjustment,
    actualUsage: computedMetrics.actualUsage,
    actualUsageAdjustment: computedMetrics.actualUsageAdjustment,
    expectedCommission: computedMetrics.expectedCommission,
    expectedCommissionAdjustment: computedMetrics.expectedCommissionAdjustment,
    actualCommission: computedMetrics.actualCommission,
    actualCommissionAdjustment: computedMetrics.actualCommissionAdjustment,
    usageBalance: computedMetrics.usageBalance,
    commissionDifference: computedMetrics.commissionDifference,
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
      account: { select: { accountName: true, accountLegalName: true } },
      vendorAccount: { select: { accountName: true } },
      product: {
        select: {
          productNameVendor: true,
          productNameHouse: true,
          partNumberVendor: true,
          partNumberHouse: true,
          partNumberDistributor: true,
        },
      },
      matches: { select: { revenueScheduleId: true, status: true } },
    },
  })
}

async function fetchCandidateSchedules(
  lineItem: NonNullable<DepositLineWithRelations>,
  options: { dateWindowMonths: number; take: number; includeFutureSchedules?: boolean; allowCrossVendorFallback?: boolean },
) {
  const referenceDate = getReferenceDate(lineItem)
  const fromDate = addMonths(referenceDate, -options.dateWindowMonths)
  const toDate = options.includeFutureSchedules
    ? addMonths(endOfMonth(referenceDate), options.dateWindowMonths)
    : endOfMonth(referenceDate)

  const strictWhere: Prisma.RevenueScheduleWhereInput = {
    tenantId: lineItem.tenantId,
    scheduleDate: { gte: fromDate, lte: toDate },
    status: { in: [RevenueScheduleStatus.Projected, RevenueScheduleStatus.Invoiced] },
  }

  if (lineItem.deposit?.distributorAccountId) {
    strictWhere.distributorAccountId = lineItem.deposit.distributorAccountId
  }
  if (lineItem.deposit?.vendorAccountId) {
    strictWhere.vendorAccountId = lineItem.deposit.vendorAccountId
  }
  if (lineItem.accountId) {
    strictWhere.accountId = lineItem.accountId
  }

  const orderBy: Prisma.RevenueScheduleOrderByWithRelationInput[] = [
    { scheduleDate: "asc" },
    { createdAt: "asc" },
  ]

  let schedules: RevenueScheduleWithRelations[] = await prisma.revenueSchedule.findMany({
    where: strictWhere,
    orderBy,
    include: candidateScheduleInclude,
    take: options.take,
  })

  schedules = schedules.map(schedule => ({ ...schedule, __isFallback: false }))

  if (schedules.length === 0 && options.allowCrossVendorFallback) {
    const fallbackWhere: Prisma.RevenueScheduleWhereInput = {
      tenantId: lineItem.tenantId,
      scheduleDate: { gte: fromDate, lte: toDate },
      status: { in: [RevenueScheduleStatus.Projected, RevenueScheduleStatus.Invoiced] },
    }

    const fallbackSchedules = await prisma.revenueSchedule.findMany({
      where: fallbackWhere,
      orderBy,
      include: candidateScheduleInclude,
      take: options.take,
    })

    schedules = fallbackSchedules.map(schedule => ({ ...schedule, __isFallback: true }))
  }

  return schedules.filter(schedule => computeCommissionDifference(schedule) > 0)
}

function scoreCandidateLegacy(
  lineItem: NonNullable<DepositLineWithRelations>,
  schedule: RevenueScheduleWithRelations,
): ScoredCandidate {
  const lineUsage = toNumber(lineItem.usage)
  const lineCommission = toNumber(lineItem.commission)
  const metrics = computeScheduleMetrics(schedule)

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

  const amountSignal = amountProximity(lineUsage, metrics.expectedUsage + metrics.expectedUsageAdjustment)
  signals.push(
    buildSimilaritySignal("usage_amount", amountSignal, 0.08, "Usage amount proximity"),
  )

  const commissionSignal = amountProximity(
    lineCommission,
    metrics.expectedCommission + metrics.expectedCommissionAdjustment,
  )
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
    ...buildCandidateBase(lineItem, schedule, metrics),
    matchConfidence,
    matchType: "legacy",
    confidenceLevel,
    signals,
    reasons,
  }
}

function buildPassACandidate(
  lineItem: NonNullable<DepositLineWithRelations>,
  schedule: RevenueScheduleWithRelations,
  varianceTolerance: number,
): ScoredCandidate | null {
  if (schedule.__isFallback) return null

  const metrics = computeScheduleMetrics(schedule)
  const signals: CandidateSignal[] = []

  const accountLegalExact = checkAccountLegalExact(lineItem, schedule)
  const orderIdExact = hasOrderIdMatch(lineItem.orderIdVendor, schedule)
  const customerIdExact = checkCustomerIdExact(lineItem, schedule)
  const accountIdExact = checkAccountIdExact(lineItem, schedule)

  signals.push(buildBooleanSignal("account_legal_exact", accountLegalExact, 0.25, "Account legal name matches"))
  signals.push(buildBooleanSignal("order_id_exact", orderIdExact, 0.25, "Order ID matches"))
  signals.push(buildBooleanSignal("customer_id_exact", customerIdExact, 0.25, "Customer ID matches"))
  signals.push(buildBooleanSignal("account_id_exact", accountIdExact, 0.25, "Account ID matches"))

  const hasStrongMatch = accountLegalExact || orderIdExact || customerIdExact || accountIdExact
  if (!hasStrongMatch) return null

  const amountScore = Math.max(
    amountProximity(toNumber(lineItem.commission), metrics.expectedCommission + metrics.expectedCommissionAdjustment),
    amountProximity(toNumber(lineItem.usage), metrics.expectedUsage + metrics.expectedUsageAdjustment),
  )
  const dateScore = dateProximity(getLinePaymentDate(lineItem), schedule.scheduleDate ?? null)

  const withinTolerance =
    amountScore >= 1 - varianceTolerance &&
    dateScore >= 1 - varianceTolerance

  if (!withinTolerance) return null

  const reasons = signals
    .filter(signal => signal.score > 0)
    .map(signal => signal.description || signal.id)

  return {
    ...buildCandidateBase(lineItem, schedule, metrics),
    matchConfidence: 1,
    matchType: "exact",
    confidenceLevel: "high",
    signals,
    reasons: reasons.length ? reasons : ["Pass A exact match"],
  }
}

function scoreCandidatePassB(
  lineItem: NonNullable<DepositLineWithRelations>,
  schedule: RevenueScheduleWithRelations,
): ScoredCandidate | null {
  if (hasStrongIdConflict(lineItem, schedule)) return null

  const metrics = computeScheduleMetrics(schedule)
  const signals: CandidateSignal[] = []

  const accountNameSim = computeNameSimilarity(
    lineItem.accountNameRaw ?? lineItem.account?.accountLegalName ?? lineItem.account?.accountName ?? "",
    schedule.account?.accountLegalName ?? schedule.account?.accountName ?? "",
  )
  signals.push(
    buildSimilaritySignal("account_name_similarity", accountNameSim, 0.4, "Account legal/name similarity"),
  )

  const productIdentitySim = computeProductIdentitySimilarity(lineItem, schedule)
  signals.push(
    buildSimilaritySignal("product_identity", productIdentitySim, 0.3, "Product identity similarity"),
  )

  const amountSignal = Math.max(
    amountProximity(toNumber(lineItem.usage), metrics.expectedUsage + metrics.expectedUsageAdjustment),
    amountProximity(toNumber(lineItem.commission), metrics.expectedCommission + metrics.expectedCommissionAdjustment),
  )
  signals.push(buildSimilaritySignal("amount_proximity", amountSignal, 0.2, "Usage/commission proximity"))

  const dateSignal = dateProximity(getLinePaymentDate(lineItem), schedule.scheduleDate ?? null)
  signals.push(buildSimilaritySignal("date_proximity", dateSignal, 0.1, "Date proximity"))

  const weightedScore = signals.reduce((acc, signal) => acc + signal.contribution, 0)
  let matchConfidence = Number(Math.min(weightedScore, 1).toFixed(4))
  const reasons = signals
    .filter(signal => signal.score > 0)
    .map(signal => signal.description || signal.id)

  if (schedule.__isFallback) {
    matchConfidence = Math.min(matchConfidence, CROSS_VENDOR_CONFIDENCE_CAP)
    reasons.push("Cross-vendor fallback candidate (confidence capped)")
  }

  const confidenceLevel = classifyConfidence(matchConfidence)

  return {
    ...buildCandidateBase(lineItem, schedule, metrics),
    matchConfidence,
    matchType: "fuzzy",
    confidenceLevel,
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

function logCandidatesDebug(lineItemId: string, candidates: ScoredCandidate[]) {
  if (!candidates.length) return
  const summary = candidates.map(candidate => ({
    schedule: candidate.revenueScheduleName,
    confidence: candidate.matchConfidence,
    type: candidate.matchType,
    date: candidate.revenueScheduleDate,
    reasons: candidate.reasons.slice(0, 3),
  }))
  // eslint-disable-next-line no-console
  console.info(`[matching] line ${lineItemId} candidates`, summary)
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

function endOfMonth(value: Date) {
  const date = new Date(value)
  date.setUTCMonth(date.getUTCMonth() + 1)
  date.setUTCDate(0)
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function addMonths(date: Date, months: number) {
  const result = new Date(date)
  result.setMonth(result.getMonth() + months)
  return result
}
