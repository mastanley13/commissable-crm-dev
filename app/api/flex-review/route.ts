import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { withPermissions, createErrorResponse } from "@/lib/api-auth"
import { prisma } from "@/lib/db"
import { formatRevenueScheduleDisplayName } from "@/lib/flex/revenue-schedule-display"

export const dynamic = "force-dynamic"

function toNumber(value: unknown): number {
  if (value == null) return 0
  if (typeof value === "number") return Number.isFinite(value) ? value : 0
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  const decimal = value as { toNumber?: () => number; toString?: () => string }
  if (typeof decimal.toNumber === "function") {
    const parsed = decimal.toNumber()
    return Number.isFinite(parsed) ? parsed : 0
  }
  if (typeof decimal.toString === "function") {
    const parsed = Number(decimal.toString())
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function parseNumber(value: string | null, fallback = 0): number {
  if (!value) return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeQuery(value: string | null): string {
  if (!value) return ""
  const trimmed = value.trim()
  return trimmed
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

function toCsvValue(value: unknown): string {
  if (value == null) return ""
  const text = String(value)
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

export async function GET(request: NextRequest) {
  return withPermissions(request, ["reconciliation.manage"], async req => {
    try {
      const tenantId = req.user.tenantId
      const searchParams = request.nextUrl.searchParams

      const status = normalizeQuery(searchParams.get("status"))
      const assignment = normalizeQuery(searchParams.get("assignment")).toLowerCase() || "all"
      const classification = normalizeQuery(searchParams.get("classification"))
      const reason = normalizeQuery(searchParams.get("reason"))
      const vendorQuery = normalizeQuery(searchParams.get("vendor"))
      const distributorQuery = normalizeQuery(searchParams.get("distributor"))
      const scheduleQuery = normalizeQuery(searchParams.get("schedule"))
      const minAgeDays = Math.max(0, parseNumber(searchParams.get("minAgeDays"), 0))
      const minAbsCommission = Math.max(0, parseNumber(searchParams.get("minAbsCommission"), 0))

      const page = Math.max(1, parseNumber(searchParams.get("page"), 1))
      const pageSize = Math.min(500, Math.max(1, parseNumber(searchParams.get("pageSize"), 200)))
      const format = normalizeQuery(searchParams.get("format")).toLowerCase()
      const includeAll = searchParams.get("includeAll") === "true" || format === "csv"

      const where: Prisma.FlexReviewItemWhereInput = { tenantId }

      if (status && status !== "All") {
        where.status = status as any
      }

      if (assignment === "mine") {
        where.assignedToUserId = req.user.id
      } else if (assignment === "unassigned") {
        where.assignedToUserId = null
      }

      if (classification && classification !== "All") {
        where.flexClassification = classification as any
      }

      if (reason && reason !== "All") {
        where.flexReasonCode = reason as any
      }

      if (minAgeDays > 0) {
        const cutoff = new Date(Date.now() - minAgeDays * 24 * 60 * 60 * 1000)
        where.createdAt = { lte: cutoff }
      }

      const scheduleFilters: Prisma.RevenueScheduleWhereInput[] = []

      if (vendorQuery) {
        scheduleFilters.push({
          vendor: { accountName: { contains: vendorQuery, mode: "insensitive" } },
        })
      }

      if (distributorQuery) {
        scheduleFilters.push({
          distributor: { accountName: { contains: distributorQuery, mode: "insensitive" } },
        })
      }

      if (scheduleQuery) {
        const scheduleOrFilters: Prisma.RevenueScheduleWhereInput[] = [
          { scheduleNumber: { contains: scheduleQuery, mode: "insensitive" } },
          { parentRevenueSchedule: { is: { scheduleNumber: { contains: scheduleQuery, mode: "insensitive" } } } },
        ]

        if (isUuid(scheduleQuery)) {
          scheduleOrFilters.push({ id: scheduleQuery })
          scheduleOrFilters.push({ parentRevenueScheduleId: scheduleQuery })
        }

        scheduleFilters.push({ OR: scheduleOrFilters })
      }

      if (minAbsCommission > 0) {
        scheduleFilters.push({
          OR: [
            { expectedCommission: { gte: minAbsCommission } },
            { expectedCommission: { lte: -minAbsCommission } },
          ],
        })
      }

      if (scheduleFilters.length > 0) {
        where.revenueSchedule = { is: { AND: scheduleFilters } }
      }

      const total = await prisma.flexReviewItem.count({ where })

      const items = await prisma.flexReviewItem.findMany({
        where,
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        include: {
          assignedToUser: { select: { id: true, fullName: true } },
          revenueSchedule: {
            select: {
              id: true,
              scheduleNumber: true,
              flexClassification: true,
              scheduleDate: true,
              expectedUsage: true,
              expectedCommission: true,
              parentRevenueScheduleId: true,
              opportunityId: true,
              productId: true,
              distributorAccountId: true,
              vendorAccountId: true,
              parentRevenueSchedule: {
                select: {
                  id: true,
                  scheduleNumber: true,
                  flexClassification: true,
                },
              },
              distributor: {
                select: { id: true, accountName: true },
              },
              vendor: {
                select: { id: true, accountName: true },
              },
            },
          },
        },
        ...(includeAll ? {} : { skip: (page - 1) * pageSize, take: pageSize }),
      })

      const data = items.map(item => {
          const schedule = item.revenueSchedule
          const parent = schedule?.parentRevenueSchedule ?? null
          const scheduleName = formatRevenueScheduleDisplayName({
            scheduleNumber: schedule?.scheduleNumber ?? null,
            fallbackId: schedule?.id ?? item.revenueScheduleId,
            flexClassification: schedule?.flexClassification ?? item.flexClassification ?? null,
          })
          const parentScheduleName = parent
            ? formatRevenueScheduleDisplayName({
                scheduleNumber: parent.scheduleNumber ?? null,
                fallbackId: parent.id,
                flexClassification: parent.flexClassification ?? null,
              })
            : null

          return {
            id: item.id,
            status: item.status,
            flexClassification: item.flexClassification,
            flexReasonCode: item.flexReasonCode ?? null,
            revenueScheduleId: item.revenueScheduleId,
            revenueScheduleName: scheduleName,
            parentRevenueScheduleId: schedule?.parentRevenueScheduleId ?? null,
            parentRevenueScheduleName: parentScheduleName,
            scheduleDate: schedule?.scheduleDate ? schedule.scheduleDate.toISOString() : null,
            opportunityId: schedule?.opportunityId ?? null,
            productId: schedule?.productId ?? null,
            distributorAccountId: schedule?.distributorAccountId ?? null,
            distributorName: schedule?.distributor?.accountName ?? null,
            vendorAccountId: schedule?.vendorAccountId ?? null,
            vendorName: schedule?.vendor?.accountName ?? null,
            sourceDepositId: item.sourceDepositId ?? null,
            sourceDepositLineItemId: item.sourceDepositLineItemId ?? null,
            expectedUsage: schedule?.expectedUsage == null ? null : toNumber(schedule.expectedUsage),
            expectedCommission: schedule?.expectedCommission == null ? null : toNumber(schedule.expectedCommission),
            assignedToUserId: item.assignedToUserId ?? null,
            assignedToName: item.assignedToUser?.fullName ?? null,
            createdAt: item.createdAt.toISOString(),
            resolvedAt: item.resolvedAt?.toISOString() ?? null,
          }
        })

      if (format === "csv") {
        const header = [
          "Status",
          "Flex Type",
          "Flex Reason",
          "Schedule",
          "Parent Schedule",
          "Schedule Date",
          "Expected Usage",
          "Expected Commission",
          "Vendor",
          "Distributor",
          "Assigned To",
          "Created At",
          "Resolved At",
          "Deposit Id",
          "Deposit Line Id",
        ]
        const rows = data.map(row => [
          row.status,
          row.flexClassification,
          row.flexReasonCode ?? "",
          row.revenueScheduleName,
          row.parentRevenueScheduleName ?? "",
          row.scheduleDate ?? "",
          row.expectedUsage ?? "",
          row.expectedCommission ?? "",
          row.vendorName ?? "",
          row.distributorName ?? "",
          row.assignedToName ?? "",
          row.createdAt ?? "",
          row.resolvedAt ?? "",
          row.sourceDepositId ?? "",
          row.sourceDepositLineItemId ?? "",
        ])

        const csv = [header, ...rows]
          .map(line => line.map(toCsvValue).join(","))
          .join("\n")

        const dateStamp = new Date().toISOString().slice(0, 10)
        return new NextResponse(csv, {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="flex-review-${dateStamp}.csv"`,
          },
        })
      }

      return NextResponse.json({
        data,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: includeAll ? 1 : Math.max(1, Math.ceil(total / pageSize)),
        },
      })
    } catch (error) {
      console.error("Failed to load flex review queue", error)
      return createErrorResponse(
        error instanceof Error ? error.message : "Failed to load flex review queue",
        500,
      )
    }
  })
}
