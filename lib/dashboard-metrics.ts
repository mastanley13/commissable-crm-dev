import {
  AccountStatus,
  HistoricalDepositBucket,
  OpportunityStage,
  RevenueScheduleStatus,
  type Prisma,
} from "@prisma/client"

import { prisma } from "@/lib/db"

export interface DashboardCrmMetrics {
  totalAccounts: number
  totalContacts: number
  activeOpportunities: number
  activeProducts: number
}

export interface DashboardReconciliationMetrics {
  totalUsage: number
  totalCommissions: number
  totalPastDueSchedules: number
}

export interface DashboardActivityItem {
  id: string
  description: string
  time: string
  user: string
}

export interface DashboardMetrics {
  crmData: DashboardCrmMetrics
  reconciliation: DashboardReconciliationMetrics
  recentActivity: DashboardActivityItem[]
}

export interface AdminOverviewMetrics {
  userAccess: {
    activeUsers: number
    totalRoles: number
    recentLogins: number
    invitedUsers: number
  }
  crmData: DashboardCrmMetrics
  revenueFinance: {
    totalRevenueSchedules: number
    unreconciledSchedules: number
    totalDeposits: number
    unmatchedItems: number
  }
  activityTasks: {
    openTickets: number
    highPriorityTickets: number
    overdueActivities: number
    recentAuditActions: number
  }
}

export interface MetricDateRange {
  from?: Date | null
  to?: Date | null
}

const INACTIVE_OPPORTUNITY_STAGES = [
  OpportunityStage.ClosedLost,
  OpportunityStage.ClosedWon_BillingEnded,
]

let depositHistoricalBucketColumnPromise: Promise<boolean> | null = null

async function hasDepositHistoricalBucketColumn(): Promise<boolean> {
  if (!depositHistoricalBucketColumnPromise) {
    depositHistoricalBucketColumnPromise = prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'Deposit'
          AND column_name = 'historicalBucket'
      ) AS "exists"
    `
      .then(rows => Boolean(rows[0]?.exists))
      .catch(error => {
        console.warn("Unable to inspect Deposit.historicalBucket support", error)
        return false
      })
  }

  return depositHistoricalBucketColumnPromise
}

const activeAccountWhere = (tenantId: string): Prisma.AccountWhereInput => ({
  tenantId,
  mergedIntoAccountId: null,
  status: { not: AccountStatus.Archived },
})

const activeContactWhere = (tenantId: string): Prisma.ContactWhereInput => ({
  tenantId,
  deletedAt: null,
  mergedIntoContactId: null,
})

const activeOpportunityWhere = (tenantId: string): Prisma.OpportunityWhereInput => ({
  tenantId,
  active: true,
  stage: { notIn: INACTIVE_OPPORTUNITY_STAGES },
})

const activeProductWhere = (tenantId: string): Prisma.ProductWhereInput => ({
  tenantId,
  isActive: true,
})

const activeRevenueScheduleWhere = (tenantId: string): Prisma.RevenueScheduleWhereInput => ({
  tenantId,
  deletedAt: null,
  parentRevenueScheduleId: null,
})

const activeDepositWhere = (
  tenantId: string,
  range: MetricDateRange = {},
  canFilterHistoricalBuckets = true,
): Prisma.DepositWhereInput => {
  const where: Prisma.DepositWhereInput = {
    tenantId,
  }

  if (canFilterHistoricalBuckets) {
    where.historicalBucket = { not: HistoricalDepositBucket.SettledHistory }
  }

  if (range.from || range.to) {
    where.paymentDate = {
      ...(range.from ? { gte: range.from } : {}),
      ...(range.to ? { lte: range.to } : {}),
    }
  }

  return where
}

function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0
  if (typeof value === "number") return Number.isFinite(value) ? value : 0
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  if (typeof value === "object" && "toNumber" in value && typeof value.toNumber === "function") {
    const parsed = value.toNumber()
    return Number.isFinite(parsed) ? parsed : 0
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function roundMoney(value: unknown): number {
  return Math.round(toNumber(value) * 100) / 100
}

function formatEntityName(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/^./, char => char.toUpperCase())
}

function formatRelativeTime(value: Date, now = new Date()): string {
  const elapsedMs = Math.max(0, now.getTime() - value.getTime())
  const minutes = Math.floor(elapsedMs / 60000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`

  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`

  return value.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: value.getFullYear() === now.getFullYear() ? undefined : "numeric",
  })
}

export function parseMetricDateParam(value: string | null): Date | null {
  if (!value) return null

  const trimmed = value.trim()
  if (!trimmed) return null

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed)
  const parsed = dateOnlyMatch
    ? new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]))
    : new Date(trimmed)

  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function normalizeMetricDateRange(from: string | null, to: string | null): MetricDateRange {
  const fromDate = parseMetricDateParam(from)
  const toDate = parseMetricDateParam(to)

  if (fromDate) {
    fromDate.setHours(0, 0, 0, 0)
  }

  if (toDate) {
    toDate.setHours(23, 59, 59, 999)
  }

  return {
    from: fromDate,
    to: toDate,
  }
}

export async function getDashboardCrmMetrics(tenantId: string): Promise<DashboardCrmMetrics> {
  const [
    totalAccounts,
    totalContacts,
    activeOpportunities,
    activeProducts,
  ] = await Promise.all([
    prisma.account.count({ where: activeAccountWhere(tenantId) }),
    prisma.contact.count({ where: activeContactWhere(tenantId) }),
    prisma.opportunity.count({ where: activeOpportunityWhere(tenantId) }),
    prisma.product.count({ where: activeProductWhere(tenantId) }),
  ])

  return {
    totalAccounts,
    totalContacts,
    activeOpportunities,
    activeProducts,
  }
}

export async function getDashboardReconciliationMetrics(
  tenantId: string,
  range: MetricDateRange = {},
): Promise<DashboardReconciliationMetrics> {
  const now = new Date()
  const canFilterHistoricalBuckets = await hasDepositHistoricalBucketColumn()
  const pastDueScheduleDateFilter: Prisma.DateTimeFilter = {
    lt: now,
    ...(range.from ? { gte: range.from } : {}),
    ...(range.to ? { lte: range.to < now ? range.to : now } : {}),
  }

  const [depositSums, totalPastDueSchedules] = await Promise.all([
    prisma.deposit.aggregate({
      where: activeDepositWhere(tenantId, range, canFilterHistoricalBuckets),
      _sum: {
        totalUsage: true,
        totalCommissions: true,
      },
    }),
    prisma.revenueSchedule.count({
      where: {
        ...activeRevenueScheduleWhere(tenantId),
        status: { not: RevenueScheduleStatus.Reconciled },
        scheduleDate: pastDueScheduleDateFilter,
      },
    }),
  ])

  return {
    totalUsage: roundMoney(depositSums._sum.totalUsage),
    totalCommissions: roundMoney(depositSums._sum.totalCommissions),
    totalPastDueSchedules,
  }
}

export async function getDashboardRecentActivity(tenantId: string): Promise<DashboardActivityItem[]> {
  const now = new Date()
  const rows = await prisma.auditLog.findMany({
    where: { tenantId },
    include: {
      user: {
        select: {
          fullName: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 4,
  })

  return rows.map(row => ({
    id: row.id,
    description: `${row.action} ${formatEntityName(row.entityName)}`,
    time: formatRelativeTime(row.createdAt, now),
    user: row.user?.fullName || row.user?.email || "System",
  }))
}

export async function getDashboardMetrics(
  tenantId: string,
  range: MetricDateRange = {},
): Promise<DashboardMetrics> {
  const [crmData, reconciliation, recentActivity] = await Promise.all([
    getDashboardCrmMetrics(tenantId),
    getDashboardReconciliationMetrics(tenantId, range),
    getDashboardRecentActivity(tenantId),
  ])

  return {
    crmData,
    reconciliation,
    recentActivity,
  }
}

export async function getAdminOverviewMetrics(tenantId: string): Promise<AdminOverviewMetrics> {
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const canFilterHistoricalBuckets = await hasDepositHistoricalBucketColumn()
  const unmatchedItemsWhere: Prisma.DepositLineItemWhereInput = {
    tenantId,
    status: "Unmatched",
  }

  if (canFilterHistoricalBuckets) {
    unmatchedItemsWhere.deposit = {
      historicalBucket: { not: HistoricalDepositBucket.SettledHistory },
    }
  }

  const [
    activeUsers,
    totalRoles,
    recentLogins,
    invitedUsers,
    crmData,
    totalRevenueSchedules,
    unreconciledSchedules,
    totalDeposits,
    unmatchedItems,
    openTickets,
    highPriorityTickets,
    overdueActivities,
    recentAuditActions,
  ] = await Promise.all([
    prisma.user.count({ where: { tenantId, status: "Active" } }),
    prisma.role.count({ where: { OR: [{ tenantId }, { tenantId: null }] } }),
    prisma.user.count({ where: { tenantId, lastLoginAt: { gte: sevenDaysAgo } } }),
    prisma.user.count({ where: { tenantId, status: "Invited" } }),
    getDashboardCrmMetrics(tenantId),
    prisma.revenueSchedule.count({ where: activeRevenueScheduleWhere(tenantId) }),
    prisma.revenueSchedule.count({
      where: {
        ...activeRevenueScheduleWhere(tenantId),
        status: RevenueScheduleStatus.Unreconciled,
      },
    }),
    prisma.deposit.count({ where: activeDepositWhere(tenantId, {}, canFilterHistoricalBuckets) }),
    prisma.depositLineItem.count({ where: unmatchedItemsWhere }),
    prisma.ticket.count({ where: { tenantId, status: { in: ["Open", "InProgress"] } } }),
    prisma.ticket.count({
      where: {
        tenantId,
        status: { in: ["Open", "InProgress"] },
        priority: { in: ["High", "Urgent"] },
      },
    }),
    prisma.activity.count({ where: { tenantId, status: "Open", dueDate: { lt: now } } }),
    prisma.auditLog.count({ where: { tenantId, createdAt: { gte: twentyFourHoursAgo } } }),
  ])

  return {
    userAccess: {
      activeUsers,
      totalRoles,
      recentLogins,
      invitedUsers,
    },
    crmData,
    revenueFinance: {
      totalRevenueSchedules,
      unreconciledSchedules,
      totalDeposits,
      unmatchedItems,
    },
    activityTasks: {
      openTickets,
      highPriorityTickets,
      overdueActivities,
      recentAuditActions,
    },
  }
}
