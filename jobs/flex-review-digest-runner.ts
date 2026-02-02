import { prisma } from "@/lib/db"

type FlexReviewDigestOptions = {
  minAgeDays?: number
  dryRun?: boolean
  now?: Date
}

export type FlexReviewDigestResult = {
  tenantId: string
  minAgeDays: number
  openCount: number
  overdueCount: number
  createdCount: number
  managerCount: number
  dryRun: boolean
}

function getDateStamp(now: Date): string {
  return now.toISOString().slice(0, 10)
}

export async function processFlexReviewDigestForTenant(
  tenantId: string,
  options: FlexReviewDigestOptions = {},
): Promise<FlexReviewDigestResult> {
  const minAgeDays = Math.max(0, options.minAgeDays ?? 7)
  const dryRun = Boolean(options.dryRun)
  const now = options.now ?? new Date()
  const cutoff = new Date(now.getTime() - minAgeDays * 24 * 60 * 60 * 1000)

  const [openCount, overdueCount] = await Promise.all([
    prisma.flexReviewItem.count({
      where: { tenantId, status: "Open" },
    }),
    prisma.flexReviewItem.count({
      where: { tenantId, status: "Open", createdAt: { lte: cutoff } },
    }),
  ])

  const assignedCounts = await prisma.flexReviewItem.groupBy({
    by: ["assignedToUserId"],
    where: { tenantId, status: "Open" },
    _count: { _all: true },
  })

  const overdueAssignedCounts = await prisma.flexReviewItem.groupBy({
    by: ["assignedToUserId"],
    where: { tenantId, status: "Open", createdAt: { lte: cutoff } },
    _count: { _all: true },
  })

  const assignedCountByUserId = new Map<string | null, number>(
    assignedCounts.map(row => [row.assignedToUserId ?? null, row._count._all ?? 0]),
  )
  const overdueAssignedCountByUserId = new Map<string | null, number>(
    overdueAssignedCounts.map(row => [row.assignedToUserId ?? null, row._count._all ?? 0]),
  )

  const managers = await prisma.user.findMany({
    where: {
      tenantId,
      role: {
        permissions: {
          some: { permission: { code: "reconciliation.manage" } },
        },
      },
    },
    select: { id: true },
  })

  const dateStamp = getDateStamp(now)
  const title = `Flex Review Queue Digest (${dateStamp})`
  const startOfDay = new Date(`${dateStamp}T00:00:00.000Z`)

  const existing = await prisma.notification.findMany({
    where: {
      tenantId,
      title,
      createdAt: { gte: startOfDay },
      userId: { in: managers.map(manager => manager.id) },
    },
    select: { userId: true },
  })
  const existingByUserId = new Set(existing.map(row => row.userId))

  let createdCount = 0

  for (const manager of managers) {
    if (existingByUserId.has(manager.id)) {
      continue
    }

    const assignedCount = assignedCountByUserId.get(manager.id) ?? 0
    const assignedOverdueCount = overdueAssignedCountByUserId.get(manager.id) ?? 0
    const unassignedCount = assignedCountByUserId.get(null) ?? 0
    const unassignedOverdueCount = overdueAssignedCountByUserId.get(null) ?? 0

    const body = `Open items: ${openCount}. Overdue (>=${minAgeDays}d): ${overdueCount}. Assigned to you: ${assignedCount} (overdue ${assignedOverdueCount}). Unassigned: ${unassignedCount} (overdue ${unassignedOverdueCount}).`

    if (!dryRun) {
      await prisma.notification.create({
        data: {
          tenantId,
          userId: manager.id,
          title,
          body,
          metadata: {
            kind: "FlexReviewDigest",
            date: dateStamp,
            minAgeDays,
            openCount,
            overdueCount,
            assignedCount,
            assignedOverdueCount,
            unassignedCount,
            unassignedOverdueCount,
          } as any,
        },
        select: { id: true },
      })
      createdCount += 1
    }
  }

  return {
    tenantId,
    minAgeDays,
    openCount,
    overdueCount,
    createdCount,
    managerCount: managers.length,
    dryRun,
  }
}

export async function processFlexReviewDigestForAllTenants(
  options: FlexReviewDigestOptions = {},
): Promise<FlexReviewDigestResult[]> {
  const tenants = await prisma.user.findMany({
    where: {
      role: {
        permissions: {
          some: { permission: { code: "reconciliation.manage" } },
        },
      },
    },
    select: { tenantId: true },
    distinct: ["tenantId"],
  })

  const results: FlexReviewDigestResult[] = []
  for (const tenant of tenants) {
    results.push(await processFlexReviewDigestForTenant(tenant.tenantId, options))
  }

  return results
}
