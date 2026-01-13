import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import {
  Prisma,
  RevenueScheduleFlexClassification,
  RevenueScheduleFlexReasonCode,
  RevenueScheduleStatus,
} from "@prisma/client"
import { withAuth } from "@/lib/api-auth"
import { dedupeColumnFilters } from "@/lib/filter-utils"
import { mapRevenueScheduleToListItem, type RevenueScheduleWithRelations } from "./helpers"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const DEFAULT_PAGE_SIZE = 100
const MAX_PAGE_SIZE = 500

export async function GET(request: NextRequest) {
  return withAuth(request, async (req) => {
    try {
      const tenantId = req.user.tenantId
      const searchParams = request.nextUrl.searchParams

      const page = Math.max(1, Number(searchParams.get("page") ?? "1"))
      const pageSize = Math.min(
        MAX_PAGE_SIZE,
        Math.max(1, Number(searchParams.get("pageSize") ?? String(DEFAULT_PAGE_SIZE)))
      )
      const query = searchParams.get("q")?.trim() ?? ""
      const statusFilter = (searchParams.get("status") ?? "all").toLowerCase()
      const disputeOnly = searchParams.get("inDispute") === "true"
      const startDateParam = searchParams.get("startDate")
      const endDateParam = searchParams.get("endDate")
      const sortColumn = searchParams.get("sort") ?? "scheduleDate"
      const sortDirection = searchParams.get("direction") === "asc" ? "asc" : "desc"
      const includeDeleted = searchParams.get("includeDeleted") === "true"
      const deletedOnly = searchParams.get("deletedOnly") === "true"

      // Define locally to decouple from client-only components
      type ColumnFilter = { columnId: string; value: string; operator?: "equals" | "contains" | "starts_with" | "ends_with" }
      let columnFilters: ColumnFilter[] = []
      const filtersParam = searchParams.get("filters")
      if (filtersParam) {
        try {
          const parsed = JSON.parse(filtersParam)
          if (Array.isArray(parsed)) {
            columnFilters = parsed
          }
        } catch {
          columnFilters = []
        }
      }

      const dedupedFilters = dedupeColumnFilters(columnFilters)

      const where: Prisma.RevenueScheduleWhereInput = { tenantId }

      // Deleted filters:
      // - default: exclude soft-deleted schedules
      // - includeDeleted=true: include both active + deleted schedules
      // - deletedOnly=true: only soft-deleted schedules (overrides includeDeleted)
      if (deletedOnly) {
        where.deletedAt = { not: null }
      } else if (!includeDeleted) {
        where.deletedAt = null
      }

      const andFilters: Prisma.RevenueScheduleWhereInput[] = []

      if (query) {
        andFilters.push({
          OR: [
            { scheduleNumber: { contains: query, mode: "insensitive" } },
            { account: { accountName: { contains: query, mode: "insensitive" } } },
            { distributor: { accountName: { contains: query, mode: "insensitive" } } },
            { vendor: { accountName: { contains: query, mode: "insensitive" } } },
            { opportunity: { name: { contains: query, mode: "insensitive" } } }
          ]
        })
      }

      if (statusFilter === "active" || statusFilter === "open") {
        andFilters.push({ status: { not: RevenueScheduleStatus.Reconciled } })
      } else if (statusFilter === "reconciled") {
        andFilters.push({ status: RevenueScheduleStatus.Reconciled })
      } else if (statusFilter === "underpaid") {
        andFilters.push({ status: RevenueScheduleStatus.Underpaid })
      } else if (statusFilter === "overpaid") {
        andFilters.push({ status: RevenueScheduleStatus.Overpaid })
      } else if (statusFilter === "unreconciled") {
        andFilters.push({ status: RevenueScheduleStatus.Unreconciled })
      }

      if (disputeOnly) {
        andFilters.push({ status: RevenueScheduleStatus.Overpaid })
      }

      if (startDateParam) {
        const parsed = new Date(startDateParam)
        if (!Number.isNaN(parsed.getTime())) {
          andFilters.push({
            scheduleDate: { gte: parsed }
          })
        }
      }

      if (endDateParam) {
        const parsed = new Date(endDateParam)
        if (!Number.isNaN(parsed.getTime())) {
          parsed.setHours(23, 59, 59, 999)
          andFilters.push({
            scheduleDate: { lte: parsed }
          })
        }
      }

      if (dedupedFilters.length > 0) {
        dedupedFilters.forEach(filter => {
          const rawValue = (filter.value ?? "").trim()
          if (!rawValue) {
            return
          }

          const normalizeEnumKey = (value: string) => value.trim().toLowerCase().replace(/[\s_-]/g, "")

          switch (filter.columnId) {
            case "accountName":
              andFilters.push({ account: { accountName: { contains: rawValue, mode: "insensitive" } } })
              break
            case "vendorName":
              andFilters.push({ vendor: { accountName: { contains: rawValue, mode: "insensitive" } } })
              break
            case "distributorName":
              andFilters.push({ distributor: { accountName: { contains: rawValue, mode: "insensitive" } } })
              break
            case "productNameVendor":
              andFilters.push({
                OR: [
                  { product: { productNameVendor: { contains: rawValue, mode: "insensitive" } } },
                  { product: { productNameDistributor: { contains: rawValue, mode: "insensitive" } } },
                ],
              })
              break
            case "revenueScheduleName":
              andFilters.push({ scheduleNumber: { contains: rawValue, mode: "insensitive" } })
              break
            case "revenueScheduleDate":
              andFilters.push({
                scheduleDate: {
                  gte: new Date(rawValue),
                  lte: new Date(new Date(rawValue).setHours(23, 59, 59, 999))
                }
              })
              break
            case "opportunityId":
              andFilters.push({ opportunityId: rawValue })
              break
            case "customerIdDistributor":
              andFilters.push({
                OR: [
                  { opportunity: { is: { customerIdDistributor: { contains: rawValue, mode: "insensitive" } } } },
                  { distributor: { accountNumber: { contains: rawValue, mode: "insensitive" } } }
                ]
              })
              break
            case "customerIdVendor":
              andFilters.push({
                OR: [
                  { opportunity: { is: { customerIdVendor: { contains: rawValue, mode: "insensitive" } } } },
                  { opportunity: { is: { customerIdDistributor: { contains: rawValue, mode: "insensitive" } } } },
                  { vendor: { accountNumber: { contains: rawValue, mode: "insensitive" } } },
                  { distributor: { accountNumber: { contains: rawValue, mode: "insensitive" } } }
                ]
              })
              break
            case "orderIdVendor":
              andFilters.push({
                OR: [
                  { opportunity: { is: { orderIdVendor: { contains: rawValue, mode: "insensitive" } } } },
                  { opportunity: { is: { orderIdDistributor: { contains: rawValue, mode: "insensitive" } } } },
                  { distributorOrderId: { contains: rawValue, mode: "insensitive" } }
                ]
              })
              break
            case "orderIdDistributor":
              andFilters.push({
                OR: [
                  { distributorOrderId: { contains: rawValue, mode: "insensitive" } },
                  { opportunity: { is: { orderIdDistributor: { contains: rawValue, mode: "insensitive" } } } }
                ]
              })
              break
            case "locationId":
              andFilters.push({
                OR: [
                  { opportunity: { is: { locationId: { contains: rawValue, mode: "insensitive" } } } },
                  { account: { accountNumber: { contains: rawValue, mode: "insensitive" } } }
                ]
              })
              break
            case "flexClassification": {
              const key = normalizeEnumKey(rawValue)
              const map: Record<string, RevenueScheduleFlexClassification> = {
                normal: RevenueScheduleFlexClassification.Normal,
                adjustment: RevenueScheduleFlexClassification.Adjustment,
                flexproduct: RevenueScheduleFlexClassification.FlexProduct,
                flexchargeback: RevenueScheduleFlexClassification.FlexChargeback,
                bonus: RevenueScheduleFlexClassification.Bonus,
              }
              const parsed = map[key]
              if (parsed) {
                andFilters.push({ flexClassification: parsed })
              }
              break
            }
            case "flexReasonCode": {
              const key = normalizeEnumKey(rawValue)
              const map: Record<string, RevenueScheduleFlexReasonCode> = {
                overagewithintolerance: RevenueScheduleFlexReasonCode.OverageWithinTolerance,
                overageoutsidetolerance: RevenueScheduleFlexReasonCode.OverageOutsideTolerance,
                unknownproduct: RevenueScheduleFlexReasonCode.UnknownProduct,
                chargebacknegative: RevenueScheduleFlexReasonCode.ChargebackNegative,
                bonusvariance: RevenueScheduleFlexReasonCode.BonusVariance,
                manual: RevenueScheduleFlexReasonCode.Manual,
              }
              const parsed = map[key]
              if (parsed) {
                andFilters.push({ flexReasonCode: parsed })
              }
              break
            }
            default:
              break
          }
        })
      }

      if (andFilters.length > 0) {
        where.AND = andFilters
      }

      const orderBy: Prisma.RevenueScheduleOrderByWithRelationInput[] = []

      if (sortColumn === "revenueScheduleDate") {
        orderBy.push({ scheduleDate: sortDirection })
      } else if (sortColumn === "revenueScheduleName") {
        orderBy.push({ scheduleNumber: sortDirection })
      } else if (sortColumn === "accountName") {
        orderBy.push({ account: { accountName: sortDirection } })
      } else if (sortColumn === "vendorName") {
        orderBy.push({ vendor: { accountName: sortDirection } })
      } else if (sortColumn === "distributorName") {
        orderBy.push({ distributor: { accountName: sortDirection } })
      } else if (sortColumn === "productNameVendor") {
        orderBy.push({ product: { productNameVendor: sortDirection } })
      } else if (sortColumn === "scheduleStatus") {
        orderBy.push({ status: sortDirection })
      } else if (sortColumn === "deletedAt") {
        orderBy.push({ deletedAt: sortDirection })
      } else if (sortColumn === "expectedUsageNet") {
        orderBy.push({ expectedUsage: sortDirection })
      } else if (sortColumn === "expectedCommissionNet") {
        orderBy.push({ expectedCommission: sortDirection })
      } else {
        orderBy.push({ scheduleDate: "desc" })
      }

      // apply deterministic fallback
      orderBy.push({ scheduleNumber: "asc" })

      const total = await prisma.revenueSchedule.count({ where })

      const schedules = await prisma.revenueSchedule.findMany({
        where,
        include: {
          account: {
            select: {
              id: true,
              accountName: true,
              accountLegalName: true,
              accountNumber: true,
              shippingAddress: {
                select: {
                  line1: true,
                  line2: true,
                  city: true,
                  state: true,
                  postalCode: true,
                  country: true
                }
              },
              billingAddress: {
                select: {
                  line1: true,
                  line2: true,
                  city: true,
                  state: true,
                  postalCode: true,
                  country: true
                }
              }
            }
          },
          distributor: {
            select: {
              id: true,
              accountName: true,
              accountNumber: true
            }
          },
          vendor: {
            select: {
              id: true,
              accountName: true,
              accountNumber: true
            }
          },
          product: {
            select: {
              id: true,
              productNameVendor: true,
              productDescriptionVendor: true,
              revenueType: true,
              commissionPercent: true,
              priceEach: true
            }
          },
          opportunityProduct: {
            select: {
              id: true,
              quantity: true,
              unitPrice: true,
              expectedUsage: true,
              expectedCommission: true
            }
          },
          opportunity: {
            select: {
              id: true,
              name: true,
              // orderIdHouse intentionally omitted to avoid client/schema drift; use schedule.orderIdHouse instead
              orderIdVendor: true,
              orderIdDistributor: true,
              customerIdHouse: true,
              customerIdVendor: true,
              customerIdDistributor: true,
              locationId: true,
              houseSplitPercent: true,
              houseRepPercent: true,
              subagentPercent: true,
              distributorName: true,
              vendorName: true,
              billingAddress: true,
              shippingAddress: true,
              description: true
            }
          }
        },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize
      })

      const items = schedules.map(schedule => mapRevenueScheduleToListItem(schedule as RevenueScheduleWithRelations))

      return NextResponse.json({
        data: items,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize)
        }
      })
    } catch (error) {
      const message = process.env.NODE_ENV === "development" && error instanceof Error
        ? `Failed to load revenue schedules: ${error.message}`
        : "Failed to load revenue schedules"
      console.error("Failed to load revenue schedules", error)
      return NextResponse.json({ error: message }, { status: 500 })
    }
  })
}
