import { NextRequest, NextResponse } from "next/server"
import { withPermissions, createErrorResponse } from "@/lib/api-auth"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"

function parseNumber(value: string | null, fallback: number): number {
  if (!value) return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export async function POST(request: NextRequest) {
  return withPermissions(request, ["reconciliation.manage"], async req => {
    const tenantId = req.user.tenantId
    const searchParams = request.nextUrl.searchParams
    const minAgeDays = Math.max(0, parseNumber(searchParams.get("minAgeDays"), 7))
    const dryRun = searchParams.get("dryRun") === "true"

    try {
      const cutoff = new Date(Date.now() - minAgeDays * 24 * 60 * 60 * 1000)

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
        assignedCounts.map(row => [row.assignedToUserId ?? null, (row as any)._count?._all ?? 0]),
      )
      const overdueAssignedCountByUserId = new Map<string | null, number>(
        overdueAssignedCounts.map(row => [row.assignedToUserId ?? null, (row as any)._count?._all ?? 0]),
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

      const dateStamp = new Date().toISOString().slice(0, 10)
      const title = `Flex Review Queue Digest (${dateStamp})`

      const created: string[] = []

      for (const manager of managers) {
        const existing = await prisma.notification.findFirst({
          where: {
            tenantId,
            userId: manager.id,
            title,
            createdAt: { gte: new Date(`${dateStamp}T00:00:00.000Z`) },
          },
          select: { id: true },
        })

        if (existing) {
          continue
        }

        const assignedCount = assignedCountByUserId.get(manager.id) ?? 0
        const assignedOverdueCount = overdueAssignedCountByUserId.get(manager.id) ?? 0
        const unassignedCount = assignedCountByUserId.get(null) ?? 0
        const unassignedOverdueCount = overdueAssignedCountByUserId.get(null) ?? 0

        const body = `Open items: ${openCount}. Overdue (>=${minAgeDays}d): ${overdueCount}. Assigned to you: ${assignedCount} (overdue ${assignedOverdueCount}). Unassigned: ${unassignedCount} (overdue ${unassignedOverdueCount}).`

        if (!dryRun) {
          const notification = await prisma.notification.create({
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
          created.push(notification.id)
        }
      }

      return NextResponse.json({
        data: {
          dryRun,
          createdCount: created.length,
          openCount,
          overdueCount,
          minAgeDays,
        },
      })
    } catch (error) {
      console.error("Failed to create flex review digest", error)
      return createErrorResponse(
        error instanceof Error ? error.message : "Failed to create flex review digest",
        500,
      )
    }
  })
}
