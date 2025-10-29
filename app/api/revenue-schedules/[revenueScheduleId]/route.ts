import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { withAuth, withPermissions } from "@/lib/api-auth"
import { mapRevenueScheduleToDetail, type RevenueScheduleWithRelations } from "../helpers"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

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
        if (typeof (payload as any)?.productRevenueType === 'string') {
          productData.revenueType = ((payload as any).productRevenueType as string).trim() || null
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
      return NextResponse.json({ data: detail })
    } catch (error) {
      console.error("Failed to update revenue schedule", error)
      return NextResponse.json({ error: "Failed to update revenue schedule" }, { status: 500 })
    }
  })
}
