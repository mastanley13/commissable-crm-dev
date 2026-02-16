import { NextRequest, NextResponse } from "next/server"
import { AuditAction, Prisma } from "@prisma/client"

import { prisma } from "@/lib/db"
import { withPermissions } from "@/lib/api-auth"
import { hasAnyPermission } from "@/lib/auth"
import { generateRevenueScheduleName } from "@/lib/revenue-schedule-number"
import { logOpportunityAudit, logRevenueScheduleAudit } from "@/lib/audit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const OPPORTUNITY_REVENUE_SCHEDULE_CREATE_ANY_PERMISSIONS = [
  "revenue-schedules.manage",
  "opportunities.edit.all",
  "opportunities.manage",
  "accounts.manage",
  "accounts.update",
]

const OPPORTUNITY_REVENUE_SCHEDULE_CREATE_ASSIGNED_PERMISSIONS = [
  "opportunities.edit.assigned",
]

const OPPORTUNITY_REVENUE_SCHEDULE_CREATE_PERMISSIONS = Array.from(
  new Set([
    ...OPPORTUNITY_REVENUE_SCHEDULE_CREATE_ANY_PERMISSIONS,
    ...OPPORTUNITY_REVENUE_SCHEDULE_CREATE_ASSIGNED_PERMISSIONS,
  ]),
)

type CommissionSplitInput = {
  house?: number | null
  houseRep?: number | null
  subagent?: number | null
}

type CreateSchedulesBody = {
  productId?: string
  seriesName?: string | null
  startDate?: string
  cadence?: "Monthly" | "Quarterly" | "OneTime"
  occurrences?: number
  quantity?: number
  priceEach?: number
  amountMode?: "auto" | "manual"
  amountPerSchedule?: number
  commissionRatePercent?: number
  commissionSplit?: CommissionSplitInput
  isChargeback?: boolean
  chargebackReason?: string | null
  notes?: string | null
}

function decimalFromNumber(value: number | null): Prisma.Decimal | null {
  if (value === null || value === undefined) {
    return null
  }
  return new Prisma.Decimal(value)
}

function parseFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null
  }

  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN

  if (!Number.isFinite(numeric)) {
    return null
  }

  return numeric
}

function parsePercentValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null
  }

  const numeric = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(numeric)) {
    return null
  }

  // Standard: percent points (0-100). Compatibility: accept fraction (0-1) and convert.
  const points = Math.abs(numeric) <= 1 ? numeric * 100 : numeric
  if (points < 0 || points > 100) {
    return null
  }

  return points
}

function addCadence(
  start: Date,
  cadence: "Monthly" | "Quarterly" | "OneTime",
  index: number,
): Date {
  if (cadence === "OneTime") {
    return start
  }

  const result = new Date(start.getTime())
  const increment = cadence === "Monthly" ? index : index * 3
  result.setMonth(result.getMonth() + increment)
  return result
}

export async function POST(
  request: NextRequest,
  { params }: { params: { opportunityId: string } },
) {
  return withPermissions(
    request,
    OPPORTUNITY_REVENUE_SCHEDULE_CREATE_PERMISSIONS,
    async req => {
      try {
        const { opportunityId } = params
        if (!opportunityId) {
          return NextResponse.json(
            { error: "Opportunity id is required" },
            { status: 400 },
          )
        }

        const rawBody = (await request.json().catch(() => null)) as
          | CreateSchedulesBody
          | null

        if (!rawBody || typeof rawBody !== "object") {
          return NextResponse.json(
            { error: "Invalid request payload" },
            { status: 400 },
          )
        }

        const tenantId = req.user.tenantId

        const opportunityProductId =
          typeof rawBody.productId === "string"
            ? rawBody.productId.trim()
            : ""

        if (!opportunityProductId) {
          return NextResponse.json(
            { error: "Opportunity product is required" },
            { status: 400 },
          )
        }

        const cadence =
          rawBody.cadence === "Quarterly" ||
          rawBody.cadence === "OneTime" ||
          rawBody.cadence === "Monthly"
            ? rawBody.cadence
            : "Monthly"

        const occurrencesRaw = rawBody.occurrences
        const occurrences =
          typeof occurrencesRaw === "number"
            ? Math.floor(occurrencesRaw)
            : Number.parseInt(String(occurrencesRaw ?? 0), 10)

        const effectiveOccurrences =
          cadence === "OneTime" ? 1 : Number.isFinite(occurrences) ? occurrences : 0

        if (!Number.isFinite(effectiveOccurrences) || effectiveOccurrences <= 0) {
          return NextResponse.json(
            { error: "Number of schedules must be a positive integer" },
            { status: 400 },
          )
        }

        const amountPerSchedule = parseFiniteNumber(rawBody.amountPerSchedule)
        if (amountPerSchedule === null) {
          return NextResponse.json(
            { error: "Amount per schedule is required" },
            { status: 400 },
          )
        }

        const commissionRatePercent = parseFiniteNumber(
          rawBody.commissionRatePercent,
        )
        if (
          commissionRatePercent === null ||
          commissionRatePercent < 0 ||
          commissionRatePercent > 100
        ) {
          return NextResponse.json(
            { error: "Commission Rate % must be between 0 and 100" },
            { status: 400 },
          )
        }

        const commissionRateFraction = commissionRatePercent / 100

        const startDateText =
          typeof rawBody.startDate === "string"
            ? rawBody.startDate.trim()
            : ""
        if (!startDateText) {
          return NextResponse.json(
            { error: "Start date is required" },
            { status: 400 },
          )
        }

        const startDate = new Date(startDateText)
        if (Number.isNaN(startDate.getTime())) {
          return NextResponse.json(
            { error: "Start date must be a valid date" },
            { status: 400 },
          )
        }

        const split = rawBody.commissionSplit ?? {}
        const rawHouse = split.house
        const rawHouseRep = split.houseRep
        const rawSubagent = split.subagent

        const housePoints =
          rawHouse === null || rawHouse === undefined
            ? null
            : parsePercentValue(rawHouse)
        const houseRepPoints =
          rawHouseRep === null || rawHouseRep === undefined
            ? null
            : parsePercentValue(rawHouseRep)
        const subagentPoints =
          rawSubagent === null || rawSubagent === undefined
            ? null
            : parsePercentValue(rawSubagent)

        if (
          rawHouse !== undefined &&
          housePoints === null
        ) {
          return NextResponse.json(
            { error: "House % must be between 0 and 100" },
            { status: 400 },
          )
        }

        if (
          rawHouseRep !== undefined &&
          houseRepPoints === null
        ) {
          return NextResponse.json(
            { error: "House Rep % must be between 0 and 100" },
            { status: 400 },
          )
        }

        if (
          rawSubagent !== undefined &&
          subagentPoints === null
        ) {
          return NextResponse.json(
            { error: "Subagent % must be between 0 and 100" },
            { status: 400 },
          )
        }

        const house = housePoints ?? 0
        const houseRep = houseRepPoints ?? 0
        const subagent = subagentPoints ?? 0
        const splitSum = house + houseRep + subagent

        if (Math.abs(splitSum - 100) > 0.01) {
          return NextResponse.json(
            { error: "Commission splits must total 100%" },
            { status: 400 },
          )
        }

        if (rawBody.isChargeback && !rawBody.chargebackReason?.trim()) {
          return NextResponse.json(
            { error: "Chargeback reason is required when marking as chargeback" },
            { status: 400 },
          )
        }

        const existingOpportunity = await prisma.opportunity.findFirst({
          where: { id: opportunityId, tenantId },
          select: {
            id: true,
            accountId: true,
            ownerId: true,
            houseSplitPercent: true,
            houseRepPercent: true,
            subagentPercent: true,
          },
        })

        if (!existingOpportunity) {
          return NextResponse.json(
            { error: "Opportunity not found" },
            { status: 404 },
          )
        }

        const canEditAny = hasAnyPermission(
          req.user,
          OPPORTUNITY_REVENUE_SCHEDULE_CREATE_ANY_PERMISSIONS,
        )
        const canEditAssigned = hasAnyPermission(
          req.user,
          OPPORTUNITY_REVENUE_SCHEDULE_CREATE_ASSIGNED_PERMISSIONS,
        )

        if (!canEditAny) {
          if (!canEditAssigned || existingOpportunity.ownerId !== req.user.id) {
            return NextResponse.json(
              { error: "Insufficient permissions to modify this opportunity" },
              { status: 403 },
            )
          }
        }

        if (!existingOpportunity.accountId) {
          return NextResponse.json(
            {
              error:
                "Cannot generate revenue schedules because the opportunity is missing an account.",
            },
            { status: 400 },
          )
        }

        const opportunityProduct = await prisma.opportunityProduct.findFirst({
          where: {
            id: opportunityProductId,
            opportunityId: existingOpportunity.id,
            tenantId,
          },
          select: {
            id: true,
            productId: true,
            product: {
              select: {
                id: true,
                commissionPercent: true,
                distributorAccountId: true,
                vendorAccountId: true,
              },
            },
          },
        })

        if (!opportunityProduct) {
          return NextResponse.json(
            { error: "Opportunity product not found" },
            { status: 404 },
          )
        }

        const finalAmountPerSchedule = amountPerSchedule
        const notes = rawBody.notes?.trim() || null
        const isChargeback = Boolean(rawBody.isChargeback)
        const chargebackReason = isChargeback
          ? rawBody.chargebackReason?.trim() || null
          : null
        const combinedNotes =
          chargebackReason && !notes
            ? `Chargeback: ${chargebackReason}`
            : chargebackReason && notes
              ? `${notes}\nChargeback: ${chargebackReason}`
              : notes

        const createdSchedules = await prisma.$transaction(async tx => {
          const previousOpportunitySplits = {
            houseSplitPercent:
              existingOpportunity.houseSplitPercent != null
                ? Number(existingOpportunity.houseSplitPercent)
                : null,
            houseRepPercent:
              existingOpportunity.houseRepPercent != null
                ? Number(existingOpportunity.houseRepPercent)
                : null,
            subagentPercent:
              existingOpportunity.subagentPercent != null
                ? Number(existingOpportunity.subagentPercent)
                : null,
          }

          // Update opportunity-level commission splits.
          await tx.opportunity.update({
            where: { id: existingOpportunity.id },
            data: {
              houseSplitPercent: house,
              houseRepPercent: houseRep,
              subagentPercent: subagent,
              updatedById: req.user.id,
            },
          })

          const schedules: Array<{
            id: string
            scheduleNumber: string | null
            scheduleDate: Date | null
            expectedUsage: number | null
            expectedCommission: number | null
          }> = []

          const baseDate = startDate

          for (let index = 0; index < effectiveOccurrences; index += 1) {
            const scheduleDate = addCadence(baseDate, cadence, index)
            const expectedUsage = Number(finalAmountPerSchedule.toFixed(2))
            const expectedCommission = Number(
              (expectedUsage * commissionRateFraction).toFixed(2),
            )

            const scheduleNumber = await generateRevenueScheduleName(tx)

              const created = await tx.revenueSchedule.create({
                data: {
                  tenantId,
                  opportunityId: existingOpportunity.id,
                  opportunityProductId: opportunityProduct.id,
                accountId: existingOpportunity.accountId!,
                productId: opportunityProduct.productId,
                distributorAccountId:
                  opportunityProduct.product?.distributorAccountId ?? null,
                  vendorAccountId:
                    opportunityProduct.product?.vendorAccountId ?? null,
                  scheduleDate,
                  expectedUsage: decimalFromNumber(expectedUsage),
                  expectedCommission: decimalFromNumber(expectedCommission),
                  expectedCommissionRatePercent: decimalFromNumber(commissionRatePercent),
                  expectedCommissionAdjustment: null,
                  scheduleNumber,
                  notes: combinedNotes,
                },
                select: {
                  id: true,
                  scheduleNumber: true,
                  scheduleDate: true,
                expectedUsage: true,
                expectedCommission: true,
              },
            })

            schedules.push({
              id: created.id,
              scheduleNumber: created.scheduleNumber ?? null,
              scheduleDate: created.scheduleDate ?? null,
              expectedUsage: created.expectedUsage
                ? Number(created.expectedUsage)
                : null,
              expectedCommission: created.expectedCommission
                ? Number(created.expectedCommission)
                : null,
            })
          }

          // Audit opportunity split changes if they changed.
          const newOpportunitySplits = {
            houseSplitPercent: house,
            houseRepPercent: houseRep,
            subagentPercent: subagent,
          }

          const splitsChanged =
            previousOpportunitySplits.houseSplitPercent !==
              newOpportunitySplits.houseSplitPercent ||
            previousOpportunitySplits.houseRepPercent !==
              newOpportunitySplits.houseRepPercent ||
            previousOpportunitySplits.subagentPercent !==
              newOpportunitySplits.subagentPercent

          if (splitsChanged) {
            await logOpportunityAudit(
              AuditAction.Update,
              existingOpportunity.id,
              req.user.id,
              tenantId,
              request,
              previousOpportunitySplits,
              newOpportunitySplits,
            )
          }

          // Audit each created schedule.
            for (const schedule of schedules) {
              await logRevenueScheduleAudit(
                AuditAction.Create,
                schedule.id,
                req.user.id,
                tenantId,
                request,
                undefined,
                {
                  scheduleNumber: schedule.scheduleNumber,
                  scheduleDate: schedule.scheduleDate,
                  expectedUsage: schedule.expectedUsage,
                  expectedCommission: schedule.expectedCommission,
                  expectedCommissionRatePercent: commissionRatePercent,
                  isChargeback,
                  chargebackReason,
                },
              )
          }

          return schedules
        })

        return NextResponse.json(
          {
            data: {
              createdCount: createdSchedules.length,
            },
          },
          { status: 201 },
        )
      } catch (error) {
        console.error("Failed to create revenue schedules", error)
        return NextResponse.json(
          { error: "Unable to create revenue schedules" },
          { status: 500 },
        )
      }
    },
  )
}
