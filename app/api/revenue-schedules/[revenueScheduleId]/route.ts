import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { withAuth, withPermissions } from "@/lib/api-auth"
import { mapRevenueScheduleToDetail, type RevenueScheduleWithRelations } from "../helpers"
import { isRevenueTypeCode } from "@/lib/revenue-types"
import { Activity, Ticket, DepositLineMatchStatus, DepositPaymentType } from "@prisma/client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function formatDepositPaymentType(value: DepositPaymentType | null | undefined): string | null {
  if (!value) return null
  // Field IDs: 06.02.003 / 06.07.003 (Payment Type)
  switch (value) {
    case DepositPaymentType.ACH:
      return "Bank Transfer"
    case DepositPaymentType.Wire:
      return "Wire Transfer"
    case DepositPaymentType.Check:
      return "Check"
    case DepositPaymentType.CreditCard:
      return "Credit Card"
    case DepositPaymentType.Other:
      return "Other"
    default:
      return String(value)
  }
}

async function getRevenueSchedulePaymentType(tenantId: string, revenueScheduleId: string): Promise<string | null> {
  const matches = await prisma.depositLineMatch.findMany({
    where: {
      tenantId,
      revenueScheduleId,
      status: DepositLineMatchStatus.Applied
    },
    select: {
      depositLineItem: {
        select: {
          deposit: {
            select: {
              paymentType: true
            }
          }
        }
      }
    }
  })

  const values = matches
    .map(match => match.depositLineItem?.deposit?.paymentType ?? null)
    .filter((value): value is DepositPaymentType => Boolean(value))

  const unique = Array.from(new Set(values))
    .map(formatDepositPaymentType)
    .filter((value): value is string => Boolean(value))

  if (unique.length === 0) return null
  if (unique.length === 1) return unique[0]
  return unique.join(", ")
}

export async function GET(request: NextRequest, { params }: { params: { revenueScheduleId: string } }) {
  return withAuth(request, async (req) => {
    try {
      const { revenueScheduleId } = params
      if (!revenueScheduleId) {
        return NextResponse.json({ error: "Revenue schedule id is required" }, { status: 400 })
      }

      const schedule = await prisma.revenueSchedule.findFirst({
        where: {
          id: revenueScheduleId,
          tenantId: req.user.tenantId
        },
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
              // orderIdHouse intentionally omitted; use schedule.orderIdHouse instead
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
        }
      })

      if (!schedule) {
        return NextResponse.json({ error: "Revenue schedule not found" }, { status: 404 })
      }

      const detail = mapRevenueScheduleToDetail(schedule as RevenueScheduleWithRelations)
      // Populate Payment Type from matched deposits, when available.
      detail.paymentType = await getRevenueSchedulePaymentType(req.user.tenantId, revenueScheduleId)

      return NextResponse.json({ data: detail })
    } catch (error) {
      console.error("Failed to load revenue schedule", error)
      return NextResponse.json({ error: "Failed to load revenue schedule" }, { status: 500 })
    }
  })
}

export async function PATCH(request: NextRequest, { params }: { params: { revenueScheduleId: string } }) {
  return withPermissions(request, ["revenue-schedules.manage"], async (req) => {
    try {
      const { revenueScheduleId } = params
      if (!revenueScheduleId) {
        return NextResponse.json({ error: "Revenue schedule id is required" }, { status: 400 })
      }

      const payload = await request.json().catch(() => ({}))
      const tenantId = req.user.tenantId

      // Ensure the schedule exists and belongs to tenant
      const existing = await prisma.revenueSchedule.findFirst({
        where: { id: revenueScheduleId, tenantId },
        include: {
          product: { select: { id: true } },
          opportunity: { select: { id: true } }
        }
      })

      if (!existing) {
        return NextResponse.json({ error: "Revenue schedule not found" }, { status: 404 })
      }

      const data: Record<string, any> = { updatedById: req.user.id }
      let hasChanges = false

      if (typeof (payload as any)?.revenueScheduleName === "string") {
        data.scheduleNumber = (payload as any).revenueScheduleName.trim() || null
        hasChanges = true
      }

      if (typeof (payload as any)?.revenueScheduleDate === "string") {
        const text: string = (payload as any).revenueScheduleDate.trim()
        if (text.length > 0) {
          const date = new Date(text)
          if (!Number.isNaN(date.getTime())) {
            data.scheduleDate = date
            hasChanges = true
          }
        } else {
          data.scheduleDate = null
          hasChanges = true
        }
      }

      if (typeof (payload as any)?.comments === "string") {
        data.notes = (payload as any).comments.trim() || null
        hasChanges = true
      }

      if (!hasChanges) {
        // continue; we may still update related entities below
      }

      // Update related Product fields
      const productId = (existing as any)?.product?.id as string | undefined
      if (productId) {
        const productData: Record<string, any> = {}
        if (typeof (payload as any)?.productNameVendor === 'string') {
          productData.productNameVendor = ((payload as any).productNameVendor as string).trim() || null
        }
        if (typeof (payload as any)?.productDescriptionVendor === 'string') {
          productData.productDescriptionVendor = ((payload as any).productDescriptionVendor as string).trim() || null
        }
        if (typeof (payload as any)?.productRevenueType === "string") {
          const rawType = ((payload as any).productRevenueType as string).trim()
          if (!rawType) {
            productData.revenueType = null
          } else if (!isRevenueTypeCode(rawType)) {
            return NextResponse.json({ error: "Invalid revenue type" }, { status: 400 })
          } else {
            productData.revenueType = rawType
          }
        }
        if (typeof (payload as any)?.expectedCommissionRatePercent === 'string') {
          const raw = ((payload as any).expectedCommissionRatePercent as string).trim()
          let value: number | null = null
          if (raw.endsWith('%')) {
            const num = Number(raw.slice(0, -1))
            if (!Number.isNaN(num)) value = num
          } else {
            const num = Number(raw)
            if (!Number.isNaN(num)) value = num <= 1 ? num * 100 : num
          }
          if (value !== null) {
            productData.commissionPercent = value
          }
        }
        if (Object.keys(productData).length > 0) {
          await prisma.product.update({ where: { id: productId }, data: productData })
          hasChanges = true
        }
      }

      // Update related Opportunity split percents (fractions)
      const oppId = (existing as any)?.opportunity?.id as string | undefined
      if (oppId) {
        const oppData: Record<string, any> = {}
        const parseFraction = (v: string): number | null => {
          const t = v.trim()
          if (!t) return null
          if (t.endsWith('%')) {
            const n = Number(t.slice(0, -1))
            if (!Number.isNaN(n)) return n / 100
            return null
          }
          const n2 = Number(t)
          if (Number.isNaN(n2)) return null
          return n2 <= 1 ? n2 : n2 / 100
        }
        if (typeof (payload as any)?.houseSplitPercent === 'string') {
          const f = parseFraction((payload as any).houseSplitPercent)
          if (f !== null) oppData.houseSplitPercent = f
        }
        if (typeof (payload as any)?.houseRepSplitPercent === 'string') {
          const f = parseFraction((payload as any).houseRepSplitPercent)
          if (f !== null) oppData.houseRepPercent = f
        }
        if (typeof (payload as any)?.subagentSplitPercent === 'string') {
          const f = parseFraction((payload as any).subagentSplitPercent)
          if (f !== null) oppData.subagentPercent = f
        }
        if (Object.keys(oppData).length > 0) {
          await prisma.opportunity.update({ where: { id: oppId }, data: oppData })
          hasChanges = true
        }
      }

      // Write schedule changes if present
      if (Object.keys(data).length > 1) {
        await prisma.revenueSchedule.update({ where: { id: revenueScheduleId }, data })
        hasChanges = true
      }

      // No updates detected across schedule, product, or opportunity
      if (!hasChanges) {
        return NextResponse.json({ error: "No changes to apply" }, { status: 400 })
      }

      // Return updated detail payload
      const updated = await prisma.revenueSchedule.findFirst({
        where: { id: revenueScheduleId, tenantId },
        include: {
          account: {
            select: {
              id: true,
              accountName: true,
              accountLegalName: true,
              accountNumber: true,
              shippingAddress: { select: { line1: true, line2: true, city: true, state: true, postalCode: true, country: true } },
              billingAddress: { select: { line1: true, line2: true, city: true, state: true, postalCode: true, country: true } }
            }
          },
          distributor: { select: { id: true, accountName: true, accountNumber: true } },
          vendor: { select: { id: true, accountName: true, accountNumber: true } },
          product: { select: { id: true, productNameVendor: true, productDescriptionVendor: true, revenueType: true, commissionPercent: true, priceEach: true } },
          opportunityProduct: { select: { id: true, quantity: true, unitPrice: true, expectedUsage: true, expectedCommission: true } },
          opportunity: { select: { id: true, name: true, orderIdHouse: true, orderIdVendor: true, orderIdDistributor: true, customerIdHouse: true, customerIdVendor: true, customerIdDistributor: true, locationId: true, houseSplitPercent: true, houseRepPercent: true, subagentPercent: true, distributorName: true, vendorName: true, billingAddress: true, shippingAddress: true, description: true } }
        }
      })

      if (!updated) {
        return NextResponse.json({ error: "Revenue schedule not found after update" }, { status: 404 })
      }

      const detail = mapRevenueScheduleToDetail(updated as RevenueScheduleWithRelations)
      detail.paymentType = await getRevenueSchedulePaymentType(tenantId, revenueScheduleId)
      return NextResponse.json({ data: detail })
    } catch (error) {
      console.error("Failed to update revenue schedule", error)
      return NextResponse.json({ error: "Failed to update revenue schedule" }, { status: 500 })
    }
  })
}

export async function DELETE(request: NextRequest, { params }: { params: { revenueScheduleId: string } }) {
  return withAuth(request, async (req) => {
    try {
      const { revenueScheduleId } = params
      if (!revenueScheduleId) {
        return NextResponse.json({ error: "Revenue schedule id is required" }, { status: 400 })
      }

      const roleCode = (req.user.role?.code ?? "").toLowerCase()
      const isAdmin = roleCode === "admin"
      const isAccounting = roleCode === "accounting"

      if (!isAdmin && !isAccounting) {
        return NextResponse.json({ error: "Only Admin or Accounting roles can delete revenue schedules" }, { status: 403 })
      }

      const tenantId = req.user.tenantId

      const schedule = await prisma.revenueSchedule.findFirst({
        where: { id: revenueScheduleId, tenantId },
        select: {
          id: true,
          scheduleNumber: true,
          actualUsage: true,
          actualUsageAdjustment: true,
          actualCommission: true,
          actualCommissionAdjustment: true,
        }
      })

      if (!schedule) {
        return NextResponse.json({ error: "Revenue schedule not found" }, { status: 404 })
      }

      const usageFields = [
        schedule.actualUsage,
        schedule.actualUsageAdjustment,
        schedule.actualCommission,
        schedule.actualCommissionAdjustment
      ]
      const hasAppliedMonies = usageFields.some((val) => {
        if (val === null || val === undefined) return false
        const n = Number(val)
        return Number.isFinite(n) && Math.abs(n) > 0.0001
      })

      const [matchCount, reconCount, primaryDepositCount] = await Promise.all([
        prisma.depositLineMatch.count({ where: { tenantId, revenueScheduleId } }),
        prisma.reconciliationItem.count({ where: { tenantId, revenueScheduleId } }),
        prisma.depositLineItem.count({ where: { tenantId, primaryRevenueScheduleId: revenueScheduleId } })
      ])

      if (hasAppliedMonies || matchCount > 0 || reconCount > 0 || primaryDepositCount > 0) {
        const label = schedule.scheduleNumber ?? schedule.id
        const reason = hasAppliedMonies
          ? "has usage or commission applied"
          : matchCount > 0
            ? "has deposit matches"
            : reconCount > 0
              ? "is in reconciliation"
              : "is linked to deposit lines"

        return NextResponse.json(
          { error: `Cannot delete revenue schedule ${label} because it ${reason}.` },
          { status: 409 }
        )
      }

      await prisma.$transaction(async (tx) => {
        // Remove non-monetary dependents to satisfy FKs
        await tx.activity.deleteMany({ where: { tenantId, revenueScheduleId } })
        await tx.ticket.deleteMany({ where: { tenantId, revenueScheduleId } })
        await tx.depositLineMatch.deleteMany({ where: { tenantId, revenueScheduleId } })
        await tx.reconciliationItem.deleteMany({ where: { tenantId, revenueScheduleId } })
        await tx.depositLineItem.updateMany({
          where: { tenantId, primaryRevenueScheduleId: revenueScheduleId },
          data: { primaryRevenueScheduleId: null }
        })

        await tx.revenueSchedule.delete({ where: { id: revenueScheduleId } })
      })

      return NextResponse.json({ success: true })
    } catch (error) {
      console.error("Failed to delete revenue schedule", error)
      return NextResponse.json(
        { error: "Failed to delete revenue schedule" },
        { status: 500 }
      )
    }
  })
}
