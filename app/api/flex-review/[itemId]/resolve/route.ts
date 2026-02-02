import { NextRequest, NextResponse } from "next/server"
import {
  AuditAction,
  DepositLineMatchStatus,
  RevenueScheduleBillingStatus,
  RevenueScheduleBillingStatusSource,
  RevenueScheduleFlexClassification,
  RevenueScheduleFlexReasonCode,
  RevenueScheduleType,
} from "@prisma/client"
import { withPermissions, createErrorResponse } from "@/lib/api-auth"
import { prisma } from "@/lib/db"
import { getClientIP, getUserAgent, logAudit, logRevenueScheduleAudit } from "@/lib/audit"
import { getTenantVarianceTolerance } from "@/lib/matching/settings"
import { recomputeRevenueScheduleFromMatches } from "@/lib/matching/revenue-schedule-status"
import { recomputeDepositLineItemAllocations } from "@/lib/matching/deposit-line-allocations"
import { recomputeDepositAggregates } from "@/lib/matching/deposit-aggregates"
import { generateRevenueScheduleName } from "@/lib/revenue-schedule-number"

export const dynamic = "force-dynamic"

const EPSILON = 0.005

function toNumber(value: unknown): number {
  const numeric = Number(value ?? 0)
  return Number.isFinite(numeric) ? numeric : 0
}

function isEffectivelyZero(value: number): boolean {
  return Math.abs(value) <= EPSILON
}

function parseMonthStart(value: string | null | undefined): Date | null {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), 1))
}

type FlexResolutionAction = "ApplyToExisting" | "ConvertToRegular" | "BonusCommission"

interface ResolveFlexReviewRequestBody {
  status?: "Resolved" | "Rejected"
  notes?: string
  action?: FlexResolutionAction
  targetScheduleIdOrNumber?: string
  productId?: string
  recurring?: boolean
  additionalScheduleCount?: number
  additionalScheduleStartDate?: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: { itemId: string } },
) {
  return withPermissions(request, ["reconciliation.manage"], async req => {
    const itemId = params?.itemId?.trim()
    const tenantId = req.user.tenantId

    if (!itemId) {
      return createErrorResponse("itemId is required", 400)
    }

    const body = (await request.json().catch(() => null)) as ResolveFlexReviewRequestBody | null
    const notes = typeof body?.notes === "string" ? body?.notes.trim() : ""
    const action = body?.action ?? null
    const status = body?.status === "Rejected" ? "Rejected" : "Resolved"
    const varianceTolerance = await getTenantVarianceTolerance(tenantId)

    try {
      if (!action) {
        const updated = await prisma.flexReviewItem.findFirst({
          where: { tenantId, id: itemId },
          select: { id: true },
        })
        if (!updated) {
          return createErrorResponse("Flex review item not found", 404)
        }

        const saved = await prisma.flexReviewItem.update({
          where: { id: updated.id },
          data: {
            status,
            notes: notes || undefined,
            resolvedAt: new Date(),
          },
          select: { id: true, status: true, resolvedAt: true },
        })

        await logAudit({
          userId: req.user.id,
          tenantId,
          action: AuditAction.Update,
          entityName: "FlexReviewItem",
          entityId: itemId,
          ipAddress: getClientIP(request),
          userAgent: getUserAgent(request),
          metadata: {
            action: "ResolveFlexReviewItem",
            flexReviewItemId: itemId,
            status: saved.status,
          },
        })

        return NextResponse.json({ data: saved })
      }

      if (action !== "ApplyToExisting" && action !== "ConvertToRegular" && action !== "BonusCommission") {
        return createErrorResponse("Invalid flex resolution action", 400)
      }

      const result = await prisma.$transaction(async tx => {
        const item = await tx.flexReviewItem.findFirst({
          where: { tenantId, id: itemId },
          select: {
            id: true,
            status: true,
            notes: true,
            revenueScheduleId: true,
            flexClassification: true,
            flexReasonCode: true,
            sourceDepositId: true,
            sourceDepositLineItemId: true,
            revenueSchedule: {
              select: {
                id: true,
                scheduleNumber: true,
                scheduleDate: true,
                scheduleType: true,
                expectedUsage: true,
                expectedCommission: true,
                billingStatus: true,
                billingStatusSource: true,
                flexClassification: true,
                flexReasonCode: true,
                parentRevenueScheduleId: true,
                accountId: true,
                opportunityId: true,
                opportunityProductId: true,
                productId: true,
                distributorAccountId: true,
                vendorAccountId: true,
                orderIdHouse: true,
                distributorOrderId: true,
                notes: true,
                deletedAt: true,
              },
            },
          },
        })

        if (!item || !item.revenueSchedule) {
          throw new Error("Flex review item not found")
        }

        if (item.status !== "Open") {
          throw new Error("Flex review item is not open")
        }

        const schedule = item.revenueSchedule
        if (schedule.deletedAt) {
          throw new Error("Flex revenue schedule is no longer active")
        }

        if (
          schedule.flexClassification === RevenueScheduleFlexClassification.FlexChargeback ||
          schedule.flexClassification === RevenueScheduleFlexClassification.FlexChargebackReversal
        ) {
          throw new Error("Chargeback items must be approved; they cannot be resolved here")
        }

        const auditEntries: Array<{
          scheduleId: string
          action: AuditAction
          before?: Record<string, unknown>
          after?: Record<string, unknown>
        }> = []

        const createdScheduleIds: string[] = []
        const parentAuditEntries: Array<{
          scheduleId: string
          action: AuditAction
          before?: Record<string, unknown>
          after?: Record<string, unknown>
        }> = []

        const maybeClearParentDispute = async (parentScheduleId: string | null, reason: string) => {
          if (!parentScheduleId) return

          const parentSchedule = await tx.revenueSchedule.findFirst({
            where: { tenantId, id: parentScheduleId, deletedAt: null },
            select: {
              id: true,
              status: true,
              billingStatus: true,
              billingStatusSource: true,
              expectedUsage: true,
              expectedCommission: true,
            },
          })
          if (!parentSchedule) return
          if (parentSchedule.billingStatus !== RevenueScheduleBillingStatus.InDispute) return
          if (parentSchedule.billingStatusSource !== RevenueScheduleBillingStatusSource.Auto) return

          const remainingFlexDisputes = await tx.revenueSchedule.count({
            where: {
              tenantId,
              parentRevenueScheduleId: parentSchedule.id,
              deletedAt: null,
              flexClassification: RevenueScheduleFlexClassification.FlexProduct,
              billingStatus: RevenueScheduleBillingStatus.InDispute,
            },
          })
          if (remainingFlexDisputes !== 0) return

          const before = {
            billingStatus: parentSchedule.billingStatus,
            billingStatusSource: parentSchedule.billingStatusSource,
          }

          const recomputedParent = await recomputeRevenueScheduleFromMatches(tx, parentSchedule.id, tenantId, {
            varianceTolerance,
          })

          const unreconciledAppliedMatchCount = await tx.depositLineMatch.count({
            where: {
              tenantId,
              revenueScheduleId: parentSchedule.id,
              status: DepositLineMatchStatus.Applied,
              reconciled: false,
            },
          })

          const nextBillingStatus =
            recomputedParent.schedule.status === "Reconciled" && unreconciledAppliedMatchCount === 0
              ? RevenueScheduleBillingStatus.Reconciled
              : RevenueScheduleBillingStatus.Open

          const updated = await tx.revenueSchedule.update({
            where: { id: parentSchedule.id },
            data: {
              billingStatus: nextBillingStatus,
              billingStatusSource: RevenueScheduleBillingStatusSource.Manual,
              billingStatusUpdatedById: req.user.id,
              billingStatusUpdatedAt: new Date(),
              billingStatusReason: reason,
            },
            select: {
              id: true,
              billingStatus: true,
              billingStatusSource: true,
            },
          })

          parentAuditEntries.push({
            scheduleId: updated.id,
            action: AuditAction.Update,
            before,
            after: {
              billingStatus: updated.billingStatus,
              billingStatusSource: updated.billingStatusSource,
              reason,
            },
          })
        }

        if (action === "ApplyToExisting") {
          const targetInput = typeof body?.targetScheduleIdOrNumber === "string" ? body.targetScheduleIdOrNumber.trim() : ""
          let targetSchedule =
            targetInput.length > 0
              ? await tx.revenueSchedule.findFirst({
                  where: { tenantId, id: targetInput, deletedAt: null },
                  select: {
                    id: true,
                    scheduleNumber: true,
                    expectedUsage: true,
                    expectedCommission: true,
                    billingStatus: true,
                    billingStatusSource: true,
                    accountId: true,
                  },
                })
              : null

          if (!targetSchedule && targetInput) {
            const matches = await tx.revenueSchedule.findMany({
              where: { tenantId, scheduleNumber: { equals: targetInput, mode: "insensitive" }, deletedAt: null },
              select: {
                id: true,
                scheduleNumber: true,
                expectedUsage: true,
                expectedCommission: true,
                billingStatus: true,
                billingStatusSource: true,
                accountId: true,
              },
              take: 2,
            })
            if (matches.length > 1) {
              throw new Error("Multiple schedules match that number; use the schedule id instead.")
            }
            targetSchedule = matches[0] ?? null
          }

          if (!targetSchedule && schedule.parentRevenueScheduleId) {
            targetSchedule = await tx.revenueSchedule.findFirst({
              where: { tenantId, id: schedule.parentRevenueScheduleId, deletedAt: null },
              select: {
                id: true,
                scheduleNumber: true,
                expectedUsage: true,
                expectedCommission: true,
                billingStatus: true,
                billingStatusSource: true,
                accountId: true,
              },
            })
          }

          if (!targetSchedule) {
            throw new Error("Target schedule not found")
          }

          if (targetSchedule.accountId !== schedule.accountId) {
            throw new Error("Target schedule must belong to the same account")
          }

          const targetBefore = {
            expectedUsage: targetSchedule.expectedUsage,
            expectedCommission: targetSchedule.expectedCommission,
            billingStatus: targetSchedule.billingStatus,
            billingStatusSource: targetSchedule.billingStatusSource,
          }

          const flexExpectedUsage = toNumber(schedule.expectedUsage)
          const flexExpectedCommission = toNumber(schedule.expectedCommission)

          await tx.revenueSchedule.update({
            where: { id: targetSchedule.id },
            data: {
              expectedUsage: toNumber(targetSchedule.expectedUsage) + flexExpectedUsage,
              expectedCommission: toNumber(targetSchedule.expectedCommission) + flexExpectedCommission,
              updatedById: req.user.id,
            },
          })

          const flexMatches = await tx.depositLineMatch.findMany({
            where: { tenantId, revenueScheduleId: schedule.id },
            select: {
              id: true,
              depositLineItemId: true,
              usageAmount: true,
              commissionAmount: true,
              status: true,
            },
          })

          const affectedLineItemIds = new Set<string>()

          for (const match of flexMatches) {
            affectedLineItemIds.add(match.depositLineItemId)

            const existing = await tx.depositLineMatch.findFirst({
              where: {
                tenantId,
                depositLineItemId: match.depositLineItemId,
                revenueScheduleId: targetSchedule.id,
              },
              select: {
                id: true,
                usageAmount: true,
                commissionAmount: true,
                status: true,
              },
            })

            if (existing) {
              const nextUsage = toNumber(existing.usageAmount) + toNumber(match.usageAmount)
              const nextCommission = toNumber(existing.commissionAmount) + toNumber(match.commissionAmount)
              const nextStatus =
                existing.status === DepositLineMatchStatus.Applied || match.status === DepositLineMatchStatus.Applied
                  ? DepositLineMatchStatus.Applied
                  : existing.status

              await tx.depositLineMatch.update({
                where: { id: existing.id },
                data: {
                  usageAmount: nextUsage,
                  commissionAmount: nextCommission,
                  status: nextStatus,
                },
              })

              await tx.depositLineMatch.delete({ where: { id: match.id } })
            } else {
              await tx.depositLineMatch.update({
                where: { id: match.id },
                data: { revenueScheduleId: targetSchedule.id },
              })
            }
          }

          const updatedTarget = await recomputeRevenueScheduleFromMatches(tx, targetSchedule.id, tenantId, {
            varianceTolerance,
          })

          const deletedAt = new Date()
          await tx.revenueSchedule.update({
            where: { id: schedule.id },
            data: {
              deletedAt,
              updatedById: req.user.id,
            },
          })

          const lineItemIds = Array.from(affectedLineItemIds)
          if (lineItemIds.length > 0) {
            for (const lineItemId of lineItemIds) {
              await recomputeDepositLineItemAllocations(tx, lineItemId, tenantId)
            }

            const depositIds = await tx.depositLineItem.findMany({
              where: { tenantId, id: { in: lineItemIds } },
              select: { depositId: true },
            })
            const uniqueDeposits = Array.from(new Set(depositIds.map(row => row.depositId)))
            for (const depositId of uniqueDeposits) {
              await recomputeDepositAggregates(tx, depositId, tenantId)
            }
          }

          await maybeClearParentDispute(schedule.parentRevenueScheduleId ?? null, "FlexResolutionParentClear:Apply")

          const targetAfter = await tx.revenueSchedule.findFirst({
            where: { id: targetSchedule.id, tenantId },
            select: {
              expectedUsage: true,
              expectedCommission: true,
              billingStatus: true,
              billingStatusSource: true,
              status: true,
            },
          })

          auditEntries.push({
            scheduleId: targetSchedule.id,
            action: AuditAction.Update,
            before: targetBefore,
            after: targetAfter ?? undefined,
          })

          auditEntries.push({
            scheduleId: schedule.id,
            action: AuditAction.Delete,
            before: { deletedAt: schedule.deletedAt ?? null },
            after: { deletedAt: deletedAt.toISOString() },
          })
        }

        if (action === "ConvertToRegular") {
          const productId = typeof body?.productId === "string" ? body.productId.trim() : ""
          if (!productId) {
            throw new Error("productId is required to convert a flex schedule")
          }

          const product = await tx.product.findFirst({
            where: { tenantId, id: productId },
            select: {
              id: true,
              productCode: true,
              productNameHouse: true,
              productNameVendor: true,
              description: true,
              revenueType: true,
              priceEach: true,
              commissionPercent: true,
              productFamilyHouse: true,
              productSubtypeHouse: true,
              productFamilyVendor: true,
              productSubtypeVendor: true,
              productNameDistributor: true,
              partNumberVendor: true,
              partNumberDistributor: true,
              distributorProductFamily: true,
              distributorProductSubtype: true,
              productDescriptionVendor: true,
              productDescriptionDistributor: true,
              distributorAccountId: true,
              vendorAccountId: true,
              distributor: { select: { accountName: true } },
              vendor: { select: { accountName: true } },
            },
          })

          if (!product) {
            throw new Error("Product not found")
          }

          if (
            (schedule.distributorAccountId && product.distributorAccountId && schedule.distributorAccountId !== product.distributorAccountId) ||
            (schedule.vendorAccountId && product.vendorAccountId && schedule.vendorAccountId !== product.vendorAccountId)
          ) {
            throw new Error("Selected product must match the schedule's distributor/vendor")
          }

          let opportunityProductId = schedule.opportunityProductId ?? null
          if (schedule.opportunityId) {
            const existingOppProduct = await tx.opportunityProduct.findFirst({
              where: { tenantId, opportunityId: schedule.opportunityId, productId: product.id },
              select: { id: true },
            })
            if (existingOppProduct) {
              opportunityProductId = existingOppProduct.id
            } else {
              const createdOppProduct = await tx.opportunityProduct.create({
                data: {
                  tenantId,
                  opportunityId: schedule.opportunityId,
                  productId: product.id,
                  productCodeSnapshot: product.productCode,
                  productNameHouseSnapshot: product.productNameHouse,
                  productNameVendorSnapshot: product.productNameVendor,
                  revenueTypeSnapshot: product.revenueType,
                  priceEachSnapshot: product.priceEach,
                  commissionPercentSnapshot: product.commissionPercent,
                  distributorNameSnapshot: product.distributor?.accountName ?? null,
                  vendorNameSnapshot: product.vendor?.accountName ?? null,
                  distributorAccountIdSnapshot: product.distributorAccountId ?? null,
                  vendorAccountIdSnapshot: product.vendorAccountId ?? null,
                  descriptionSnapshot: product.description ?? null,
                  productFamilyHouseSnapshot: product.productFamilyHouse ?? null,
                  productSubtypeHouseSnapshot: product.productSubtypeHouse ?? null,
                  productFamilyVendorSnapshot: product.productFamilyVendor ?? null,
                  productSubtypeVendorSnapshot: product.productSubtypeVendor ?? null,
                  productNameDistributorSnapshot: product.productNameDistributor ?? null,
                  partNumberVendorSnapshot: product.partNumberVendor ?? null,
                  partNumberDistributorSnapshot: product.partNumberDistributor ?? null,
                  distributorProductFamilySnapshot: product.distributorProductFamily ?? null,
                  distributorProductSubtypeSnapshot: product.distributorProductSubtype ?? null,
                  productDescriptionVendorSnapshot: product.productDescriptionVendor ?? null,
                  productDescriptionDistributorSnapshot: product.productDescriptionDistributor ?? null,
                  expectedUsage: schedule.expectedUsage,
                  expectedCommission: schedule.expectedCommission,
                },
                select: { id: true },
              })
              opportunityProductId = createdOppProduct.id
            }
          }

          const convertedBefore = {
            productId: schedule.productId,
            opportunityProductId: schedule.opportunityProductId,
            flexClassification: schedule.flexClassification,
            flexReasonCode: schedule.flexReasonCode,
            parentRevenueScheduleId: schedule.parentRevenueScheduleId,
            scheduleType: schedule.scheduleType,
            billingStatus: schedule.billingStatus,
            billingStatusSource: schedule.billingStatusSource,
          }

          const recurring = Boolean(body?.recurring)
          const updated = await tx.revenueSchedule.update({
            where: { id: schedule.id },
            data: {
              productId: product.id,
              opportunityProductId,
              flexClassification: RevenueScheduleFlexClassification.Normal,
              flexReasonCode: null,
              parentRevenueScheduleId: null,
              scheduleType: recurring ? RevenueScheduleType.Recurring : RevenueScheduleType.OneTime,
              updatedById: req.user.id,
            },
            select: {
              id: true,
              scheduleDate: true,
              expectedUsage: true,
              expectedCommission: true,
            },
          })

          if (recurring) {
            const additionalCountRaw = Number(body?.additionalScheduleCount ?? 0)
            const additionalCount = Number.isFinite(additionalCountRaw) ? Math.max(0, Math.floor(additionalCountRaw)) : 0
            const startDate = parseMonthStart(body?.additionalScheduleStartDate ?? null)

            if (additionalCount > 0 && !startDate) {
              throw new Error("additionalScheduleStartDate is required for recurring schedules")
            }

            if (additionalCount > 0 && startDate) {
              for (let i = 0; i < additionalCount; i++) {
                const date = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + i, 1))
                const scheduleNumber = await generateRevenueScheduleName(tx as any)
                const created = await tx.revenueSchedule.create({
                  data: {
                    tenantId,
                    accountId: schedule.accountId,
                    opportunityId: schedule.opportunityId,
                    opportunityProductId,
                    productId: product.id,
                    distributorAccountId: schedule.distributorAccountId,
                    vendorAccountId: schedule.vendorAccountId,
                    scheduleNumber,
                    scheduleDate: date,
                    scheduleType: RevenueScheduleType.Recurring,
                    expectedUsage: updated.expectedUsage,
                    expectedCommission: updated.expectedCommission,
                    orderIdHouse: schedule.orderIdHouse ?? null,
                    distributorOrderId: schedule.distributorOrderId ?? null,
                    notes: schedule.notes ?? null,
                    status: "Unreconciled",
                    createdById: req.user.id,
                    updatedById: req.user.id,
                  },
                  select: { id: true },
                })
                createdScheduleIds.push(created.id)
              }
            }
          }

          const recomputed = await recomputeRevenueScheduleFromMatches(tx, schedule.id, tenantId, {
            varianceTolerance,
          })

          const unreconciledAppliedMatchCount = await tx.depositLineMatch.count({
            where: {
              tenantId,
              revenueScheduleId: schedule.id,
              status: DepositLineMatchStatus.Applied,
              reconciled: false,
            },
          })

          const nextBillingStatus =
            recomputed.schedule.status === "Reconciled" && unreconciledAppliedMatchCount === 0
              ? RevenueScheduleBillingStatus.Reconciled
              : RevenueScheduleBillingStatus.Open

          await tx.revenueSchedule.update({
            where: { id: schedule.id },
            data: {
              billingStatus: nextBillingStatus,
              billingStatusSource: RevenueScheduleBillingStatusSource.Manual,
              billingStatusUpdatedById: req.user.id,
              billingStatusUpdatedAt: new Date(),
              billingStatusReason: "FlexResolutionConvert",
            },
          })

          await maybeClearParentDispute(schedule.parentRevenueScheduleId ?? null, "FlexResolutionParentClear:Convert")

          const convertedAfter = await tx.revenueSchedule.findFirst({
            where: { id: schedule.id, tenantId },
            select: {
              productId: true,
              opportunityProductId: true,
              flexClassification: true,
              flexReasonCode: true,
              parentRevenueScheduleId: true,
              scheduleType: true,
              billingStatus: true,
              billingStatusSource: true,
            },
          })

          auditEntries.push({
            scheduleId: schedule.id,
            action: AuditAction.Update,
            before: convertedBefore,
            after: convertedAfter ?? undefined,
          })

          for (const createdId of createdScheduleIds) {
            auditEntries.push({
              scheduleId: createdId,
              action: AuditAction.Create,
              after: { action: "FlexResolutionRecurringCreate" },
            })
          }
        }

        if (action === "BonusCommission") {
          const bonusBefore = {
            expectedUsage: schedule.expectedUsage,
            expectedCommission: schedule.expectedCommission,
            flexClassification: schedule.flexClassification,
            flexReasonCode: schedule.flexReasonCode,
            billingStatus: schedule.billingStatus,
            billingStatusSource: schedule.billingStatusSource,
          }

          let expectedUsage = toNumber(schedule.expectedUsage)
          const expectedCommission = toNumber(schedule.expectedCommission)
          if (isEffectivelyZero(expectedUsage) && !isEffectivelyZero(expectedCommission)) {
            expectedUsage = Math.abs(expectedCommission)
          }

          await tx.revenueSchedule.update({
            where: { id: schedule.id },
            data: {
              expectedUsage,
              flexClassification: RevenueScheduleFlexClassification.Bonus,
              flexReasonCode: RevenueScheduleFlexReasonCode.BonusVariance,
              scheduleType: RevenueScheduleType.OneTime,
              updatedById: req.user.id,
            },
          })

          const recomputed = await recomputeRevenueScheduleFromMatches(tx, schedule.id, tenantId, {
            varianceTolerance,
          })

          const unreconciledAppliedMatchCount = await tx.depositLineMatch.count({
            where: {
              tenantId,
              revenueScheduleId: schedule.id,
              status: DepositLineMatchStatus.Applied,
              reconciled: false,
            },
          })

          const nextBillingStatus =
            recomputed.schedule.status === "Reconciled" && unreconciledAppliedMatchCount === 0
              ? RevenueScheduleBillingStatus.Reconciled
              : RevenueScheduleBillingStatus.Open

          await tx.revenueSchedule.update({
            where: { id: schedule.id },
            data: {
              billingStatus: nextBillingStatus,
              billingStatusSource: RevenueScheduleBillingStatusSource.Manual,
              billingStatusUpdatedById: req.user.id,
              billingStatusUpdatedAt: new Date(),
              billingStatusReason: "FlexResolutionBonus",
            },
          })

          await maybeClearParentDispute(schedule.parentRevenueScheduleId ?? null, "FlexResolutionParentClear:Bonus")

          const bonusAfter = await tx.revenueSchedule.findFirst({
            where: { id: schedule.id, tenantId },
            select: {
              expectedUsage: true,
              expectedCommission: true,
              flexClassification: true,
              flexReasonCode: true,
              billingStatus: true,
              billingStatusSource: true,
            },
          })

          auditEntries.push({
            scheduleId: schedule.id,
            action: AuditAction.Update,
            before: bonusBefore,
            after: bonusAfter ?? undefined,
          })
        }

        const saved = await tx.flexReviewItem.update({
          where: { id: item.id },
          data: {
            status: "Resolved",
            notes: notes || undefined,
            resolvedAt: new Date(),
          },
          select: { id: true, status: true, resolvedAt: true },
        })

        return {
          item: saved,
          auditEntries: [...auditEntries, ...parentAuditEntries],
          action,
          createdScheduleIds,
        }
      })

      for (const entry of result.auditEntries) {
        await logRevenueScheduleAudit(
          entry.action,
          entry.scheduleId,
          req.user.id,
          tenantId,
          request,
          entry.before,
          entry.after,
        )
      }

      await logAudit({
        userId: req.user.id,
        tenantId,
        action: AuditAction.Update,
        entityName: "FlexReviewItem",
        entityId: itemId,
        ipAddress: getClientIP(request),
        userAgent: getUserAgent(request),
        metadata: {
          action: "ResolveFlexReviewItem",
          flexReviewItemId: itemId,
          status: result.item.status,
          resolutionAction: action,
          createdScheduleIds: result.createdScheduleIds,
        },
      })

      return NextResponse.json({ data: result.item })
    } catch (error) {
      console.error("Failed to resolve flex review item", error)
      return createErrorResponse(
        error instanceof Error ? error.message : "Failed to resolve flex review item",
        400,
      )
    }
  })
}
