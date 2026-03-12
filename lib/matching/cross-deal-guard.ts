import { Prisma, PrismaClient } from "@prisma/client"

import { parseMultiValueMatchSet } from "@/lib/multi-value"

type PrismaClientOrTx = PrismaClient | Prisma.TransactionClient

type AccountReference = {
  accountName?: string | null
  accountLegalName?: string | null
} | null

type ScheduleOpportunityReference = {
  id?: string
  name?: string | null
} | null

export type CrossDealGuardLine = {
  id: string
  accountId?: string | null
  accountIdVendor?: string | null
  accountNameRaw?: string | null
  customerIdVendor?: string | null
  orderIdVendor?: string | null
  locationId?: string | null
  customerPurchaseOrder?: string | null
  account?: AccountReference
}

export type CrossDealGuardSchedule = {
  id: string
  accountId?: string | null
  opportunityId?: string | null
  account?: AccountReference
  opportunity?: ScheduleOpportunityReference
}

export type CrossDealGuardIssue = {
  lineId: string
  scheduleId: string
  scheduleOpportunityId: string
  candidateOpportunityIds: string[]
  message: string
}

type ResolvedAccount = {
  id: string
  accountName: string | null
  accountLegalName: string | null
}

type OpportunityCandidate = {
  id: string
  accountId: string
  accountIdHouse: string | null
  accountIdVendor: string | null
  accountIdDistributor: string | null
  customerIdHouse: string | null
  customerIdVendor: string | null
  customerIdDistributor: string | null
  orderIdHouse: string | null
  orderIdVendor: string | null
  orderIdDistributor: string | null
  locationId: string | null
  customerPurchaseOrder: string | null
}

type LineOpportunityResolution =
  | {
      resolved: true
      lineLabel: string
      candidateOpportunityIds: Set<string>
    }
  | {
      resolved: false
      lineLabel: string
      reason: "missing_context" | "no_matches" | "conflicting_matches"
    }

function normalizeAccountName(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ")
}

function getResolvedLineLabel(line: CrossDealGuardLine, resolvedAccount: ResolvedAccount | null): string {
  return (
    resolvedAccount?.accountLegalName ??
    resolvedAccount?.accountName ??
    line.account?.accountLegalName ??
    line.account?.accountName ??
    line.accountNameRaw?.trim() ??
    "the selected deposit line"
  )
}

function getScheduleLabel(schedule: CrossDealGuardSchedule): string {
  return (
    schedule.opportunity?.name?.trim() ??
    schedule.account?.accountLegalName ??
    schedule.account?.accountName ??
    "the selected revenue schedule"
  )
}

function setIntersection(sets: Set<string>[]): Set<string> {
  if (sets.length === 0) return new Set<string>()
  const [first, ...rest] = sets
  const result = new Set<string>(first)
  for (const token of Array.from(result)) {
    if (!rest.every(current => current.has(token))) {
      result.delete(token)
    }
  }
  return result
}

async function resolveLineAccounts(
  client: PrismaClientOrTx,
  tenantId: string,
  lines: readonly CrossDealGuardLine[],
): Promise<Map<string, ResolvedAccount>> {
  const names = Array.from(
    new Set(
      lines
        .filter(line => !line.accountId)
        .map(line => line.accountNameRaw?.trim() ?? "")
        .filter(Boolean),
    ),
  )

  const resolved = new Map<string, ResolvedAccount>()

  await Promise.all(
    names.map(async rawName => {
      const matches = await client.account.findMany({
        where: {
          tenantId,
          OR: [
            { accountName: { equals: rawName, mode: "insensitive" } },
            { accountLegalName: { equals: rawName, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          accountName: true,
          accountLegalName: true,
        },
        take: 2,
      })

      if (matches.length === 1) {
        resolved.set(normalizeAccountName(rawName), matches[0]!)
      }
    }),
  )

  return resolved
}

function buildOpportunityWhere(params: {
  tenantId: string
  accountId: string | null
  accountIdTokens: string[]
  customerIdTokens: string[]
  orderIdTokens: string[]
  locationTokens: string[]
  purchaseOrderTokens: string[]
}): Prisma.OpportunityWhereInput | null {
  const ors: Prisma.OpportunityWhereInput[] = []

  if (params.accountId) {
    ors.push({ accountId: params.accountId })
  }

  for (const token of params.accountIdTokens) {
    ors.push(
      { accountIdVendor: { equals: token, mode: "insensitive" } },
      { accountIdDistributor: { equals: token, mode: "insensitive" } },
      { accountIdHouse: { equals: token, mode: "insensitive" } },
    )
  }

  for (const token of params.customerIdTokens) {
    ors.push(
      { customerIdVendor: { equals: token, mode: "insensitive" } },
      { customerIdDistributor: { equals: token, mode: "insensitive" } },
      { customerIdHouse: { equals: token, mode: "insensitive" } },
    )
  }

  for (const token of params.orderIdTokens) {
    ors.push(
      { orderIdVendor: { equals: token, mode: "insensitive" } },
      { orderIdDistributor: { equals: token, mode: "insensitive" } },
      { orderIdHouse: { equals: token, mode: "insensitive" } },
    )
  }

  for (const token of params.locationTokens) {
    ors.push({ locationId: { equals: token, mode: "insensitive" } })
  }

  for (const token of params.purchaseOrderTokens) {
    ors.push({ customerPurchaseOrder: { equals: token, mode: "insensitive" } })
  }

  if (ors.length === 0) {
    return null
  }

  return {
    tenantId: params.tenantId,
    OR: ors,
  }
}

function filterMatchingOpportunityIds(
  opportunities: readonly OpportunityCandidate[],
  predicate: (opportunity: OpportunityCandidate) => boolean,
): Set<string> {
  const ids = new Set<string>()
  for (const opportunity of opportunities) {
    if (predicate(opportunity)) {
      ids.add(opportunity.id)
    }
  }
  return ids
}

function hasContext(line: CrossDealGuardLine, resolvedAccountId: string | null) {
  return Boolean(
    resolvedAccountId ||
      line.accountIdVendor ||
      line.customerIdVendor ||
      line.orderIdVendor ||
      line.locationId ||
      line.customerPurchaseOrder,
  )
}

async function resolveLineOpportunityContext(
  client: PrismaClientOrTx,
  params: {
    tenantId: string
    line: CrossDealGuardLine
    resolvedAccount: ResolvedAccount | null
  },
): Promise<LineOpportunityResolution> {
  const { tenantId, line, resolvedAccount } = params
  const lineLabel = getResolvedLineLabel(line, resolvedAccount)
  const resolvedAccountId = line.accountId ?? resolvedAccount?.id ?? null

  if (!hasContext(line, resolvedAccountId)) {
    return { resolved: false, lineLabel, reason: "missing_context" }
  }

  const accountIdTokens = Array.from(parseMultiValueMatchSet(line.accountIdVendor, { kind: "id" }))
  const customerIdTokens = Array.from(parseMultiValueMatchSet(line.customerIdVendor, { kind: "id" }))
  const orderIdTokens = Array.from(parseMultiValueMatchSet(line.orderIdVendor, { kind: "id" }))
  const locationTokens = Array.from(parseMultiValueMatchSet(line.locationId, { kind: "id" }))
  const purchaseOrderTokens = Array.from(parseMultiValueMatchSet(line.customerPurchaseOrder, { kind: "id" }))

  const where = buildOpportunityWhere({
    tenantId,
    accountId: resolvedAccountId,
    accountIdTokens,
    customerIdTokens,
    orderIdTokens,
    locationTokens,
    purchaseOrderTokens,
  })

  if (!where) {
    return { resolved: false, lineLabel, reason: "missing_context" }
  }

  const opportunities = await client.opportunity.findMany({
    where,
    select: {
      id: true,
      accountId: true,
      accountIdHouse: true,
      accountIdVendor: true,
      accountIdDistributor: true,
      customerIdHouse: true,
      customerIdVendor: true,
      customerIdDistributor: true,
      orderIdHouse: true,
      orderIdVendor: true,
      orderIdDistributor: true,
      locationId: true,
      customerPurchaseOrder: true,
    },
    take: 50,
  })

  if (opportunities.length === 0) {
    return { resolved: false, lineLabel, reason: "no_matches" }
  }

  const candidateSets: Set<string>[] = []

  if (resolvedAccountId) {
    const ids = filterMatchingOpportunityIds(opportunities, opportunity => opportunity.accountId === resolvedAccountId)
    if (ids.size > 0) candidateSets.push(ids)
  }

  if (accountIdTokens.length > 0) {
    const ids = filterMatchingOpportunityIds(opportunities, opportunity => {
      const opportunityAccountIds = new Set<string>([
        ...parseMultiValueMatchSet(opportunity.accountIdHouse, { kind: "id" }),
        ...parseMultiValueMatchSet(opportunity.accountIdVendor, { kind: "id" }),
        ...parseMultiValueMatchSet(opportunity.accountIdDistributor, { kind: "id" }),
      ])
      return accountIdTokens.some(token => opportunityAccountIds.has(token))
    })
    if (ids.size > 0) candidateSets.push(ids)
  }

  if (customerIdTokens.length > 0) {
    const ids = filterMatchingOpportunityIds(opportunities, opportunity => {
      const opportunityCustomerIds = new Set<string>([
        ...parseMultiValueMatchSet(opportunity.customerIdHouse, { kind: "id" }),
        ...parseMultiValueMatchSet(opportunity.customerIdVendor, { kind: "id" }),
        ...parseMultiValueMatchSet(opportunity.customerIdDistributor, { kind: "id" }),
      ])
      return customerIdTokens.some(token => opportunityCustomerIds.has(token))
    })
    if (ids.size > 0) candidateSets.push(ids)
  }

  if (orderIdTokens.length > 0) {
    const ids = filterMatchingOpportunityIds(opportunities, opportunity => {
      const opportunityOrderIds = new Set<string>([
        ...parseMultiValueMatchSet(opportunity.orderIdHouse, { kind: "id" }),
        ...parseMultiValueMatchSet(opportunity.orderIdVendor, { kind: "id" }),
        ...parseMultiValueMatchSet(opportunity.orderIdDistributor, { kind: "id" }),
      ])
      return orderIdTokens.some(token => opportunityOrderIds.has(token))
    })
    if (ids.size > 0) candidateSets.push(ids)
  }

  if (locationTokens.length > 0) {
    const ids = filterMatchingOpportunityIds(opportunities, opportunity => {
      const opportunityLocations = parseMultiValueMatchSet(opportunity.locationId, { kind: "id" })
      return locationTokens.some(token => opportunityLocations.has(token))
    })
    if (ids.size > 0) candidateSets.push(ids)
  }

  if (purchaseOrderTokens.length > 0) {
    const ids = filterMatchingOpportunityIds(opportunities, opportunity => {
      const opportunityPurchaseOrders = parseMultiValueMatchSet(opportunity.customerPurchaseOrder, { kind: "id" })
      return purchaseOrderTokens.some(token => opportunityPurchaseOrders.has(token))
    })
    if (ids.size > 0) candidateSets.push(ids)
  }

  if (candidateSets.length === 0) {
    return { resolved: false, lineLabel, reason: "no_matches" }
  }

  const candidateOpportunityIds = setIntersection(candidateSets)
  if (candidateOpportunityIds.size === 0) {
    return { resolved: false, lineLabel, reason: "conflicting_matches" }
  }

  return {
    resolved: true,
    lineLabel,
    candidateOpportunityIds,
  }
}

export async function findCrossDealGuardIssues(
  client: PrismaClientOrTx,
  params: {
    tenantId: string
    lines: readonly CrossDealGuardLine[]
    schedules: readonly CrossDealGuardSchedule[]
  },
): Promise<CrossDealGuardIssue[]> {
  const resolvedLineAccounts = await resolveLineAccounts(client, params.tenantId, params.lines)
  const issues: CrossDealGuardIssue[] = []
  const seen = new Set<string>()

  for (const line of params.lines) {
    const resolvedLineAccount =
      line.accountId || !line.accountNameRaw
        ? null
        : resolvedLineAccounts.get(normalizeAccountName(line.accountNameRaw))

    const resolution = await resolveLineOpportunityContext(client, {
      tenantId: params.tenantId,
      line,
      resolvedAccount: resolvedLineAccount ?? null,
    })

    if (!resolution.resolved) {
      if (resolution.reason !== "missing_context") {
        console.warn("Cross-deal guard could not resolve opportunity context; allowing manual reconciliation", {
          tenantId: params.tenantId,
          lineId: line.id,
          reason: resolution.reason,
        })
      }
      continue
    }

    for (const schedule of params.schedules) {
      const scheduleOpportunityId = schedule.opportunityId?.trim()
      if (!scheduleOpportunityId) {
        continue
      }
      if (resolution.candidateOpportunityIds.has(scheduleOpportunityId)) {
        continue
      }

      const issueKey = `${line.id}:${schedule.id}:${scheduleOpportunityId}`
      if (seen.has(issueKey)) {
        continue
      }
      seen.add(issueKey)

      issues.push({
        lineId: line.id,
        scheduleId: schedule.id,
        scheduleOpportunityId,
        candidateOpportunityIds: Array.from(resolution.candidateOpportunityIds),
        message: `This deposit line appears to belong to ${resolution.lineLabel} and cannot be reconciled to ${getScheduleLabel(schedule)}. Pick a revenue schedule from the same deal/opportunity context.`,
      })
    }
  }

  return issues
}
