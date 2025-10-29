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
        select: { id: true }
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
        return NextResponse.json({ error: "No changes to apply" }, { status: 400 })
      }

      await prisma.revenueSchedule.update({
        where: { id: revenueScheduleId },
        data
      })

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
