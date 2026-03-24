import { NextRequest, NextResponse } from "next/server"
import {
  AuditAction,
  DepositLineMatchSource,
  DepositLineMatchStatus,
  DepositMatchGroupStatus,
  DepositMatchType,
  RevenueScheduleFlexClassification,
  RevenueScheduleFlexReasonCode,
  RevenueScheduleType,
  Prisma,
} from "@prisma/client"
import { withPermissions, createErrorResponse } from "@/lib/api-auth"
import { prisma } from "@/lib/db"
import { recomputeDepositAggregates } from "@/lib/matching/deposit-aggregates"
import { recomputeDepositLineItemAllocations } from "@/lib/matching/deposit-line-allocations"
import { recomputeRevenueSchedules } from "@/lib/matching/revenue-schedule-status"
import { getTenantVarianceTolerance } from "@/lib/matching/settings"
import {
  buildMatchGroupPreview,
  type MatchGroupAllocationInput,
  type MatchGroupPreviewAllocation,
} from "@/lib/matching/match-group-preview"
import type { MatchSelectionType } from "@/lib/matching/match-selection"
import { autoFillFromDepositMatch } from "@/lib/matching/auto-fill"
import { getClientIP, getUserAgent, logAudit, logRevenueScheduleAudit } from "@/lib/audit"
import { logMatchingMetric } from "@/lib/matching/metrics"
import { generateChildRevenueScheduleName } from "@/lib/revenue-schedule-number"
import { isBonusLikeProduct } from "@/lib/flex/bonus-detection"
import { findFutureSchedulesInScope, resolveScheduleScopeKey } from "@/lib/reconciliation/future-schedules"
import {
  createRevenueScheduleAdjustment,
  roundMoney,
} from "@/lib/reconciliation/revenue-schedule-adjustments"

type ApplyRequestBody = {
  matchType: MatchSelectionType
  lineIds: string[]
  scheduleIds: string[]
  allocations?: MatchGroupAllocationInput[] | null
  varianceResolutions?: Array<{
    scheduleId: string
    action: "AdjustCurrent" | "AdjustCurrentAndFuture" | "FlexChild"
  }> | null
}

function toNumber(value: unknown): number {
  const numeric = Number(value ?? 0)
  return Number.isFinite(numeric) ? numeric : 0
}

const EPSILON = 0.005

function isEffectivelyZero(value: number): boolean {
  return Math.abs(value) <= EPSILON
}

type NormalizedVarianceResolution = {
  scheduleId: string
  action: "AdjustCurrent" | "AdjustCurrentAndFuture" | "FlexChild"
}

function normalizeVarianceResolutionInput(value: ApplyRequestBody["varianceResolutions"]): NormalizedVarianceResolution[] {
  if (!Array.isArray(value)) return []
  const out: NormalizedVarianceResolution[] = []
  for (const item of value) {
    const scheduleId = typeof item?.scheduleId === "string" ? item.scheduleId.trim() : ""
    const action = item?.action
    if (!scheduleId || (action !== "AdjustCurrent" && action !== "AdjustCurrentAndFuture" && action !== "FlexChild")) continue
    out.push({ scheduleId, action })
  }
  return out
}

type ResolutionMutationArtifacts = {
  createdRevenueScheduleIds: string[]
  createdOpportunityProductIds: string[]
  createdProductIds: string[]
  createdAdjustmentIds: string[]
  affectedRevenueScheduleIds: string[]
  resolutionType: string | null
}

type TransformedAllocation = MatchGroupPreviewAllocation

function distributeResolvedAllocation(params: {
  allocations: TransformedAllocation[]
  splitUsage: number
  splitCommission: number
  childScheduleId: string
}): TransformedAllocation[] {
  const remainingUsageByKey = new Map<string, number>()
  const remainingCommissionByKey = new Map<string, number>()

  let usageRemaining = roundMoney(params.splitUsage)
  for (const allocation of params.allocations) {
    const key = `${allocation.lineId}:${allocation.scheduleId}`
    const moveUsage = Math.min(roundMoney(allocation.usageAmount), usageRemaining)
    remainingUsageByKey.set(key, moveUsage)
    usageRemaining = roundMoney(usageRemaining - moveUsage)
  }

  if (usageRemaining > 0.01) {
    throw new Error("Unable to split the full usage overage from the selected grouped allocations")
  }

  let commissionRemaining = roundMoney(params.splitCommission)
  for (const allocation of params.allocations) {
    const key = `${allocation.lineId}:${allocation.scheduleId}`
    const moveCommission = Math.min(roundMoney(allocation.commissionAmount), commissionRemaining)
    remainingCommissionByKey.set(key, moveCommission)
    commissionRemaining = roundMoney(commissionRemaining - moveCommission)
  }

  if (commissionRemaining > 0.01) {
    throw new Error("Unable to split the full commission overage from the selected grouped allocations")
  }

  const transformed: TransformedAllocation[] = []
  for (const allocation of params.allocations) {
    const key = `${allocation.lineId}:${allocation.scheduleId}`
    const movedUsage = remainingUsageByKey.get(key) ?? 0
    const movedCommission = remainingCommissionByKey.get(key) ?? 0
    const nextBaseUsage = roundMoney(allocation.usageAmount - movedUsage)
    const nextBaseCommission = roundMoney(allocation.commissionAmount - movedCommission)

    transformed.push({
      ...allocation,
      usageAmount: nextBaseUsage,
      commissionAmount: nextBaseCommission,
    })

    if (!isEffectivelyZero(movedUsage) || !isEffectivelyZero(movedCommission)) {
      transformed.push({
        lineId: allocation.lineId,
        scheduleId: params.childScheduleId,
        usageAmount: roundMoney(movedUsage),
        commissionAmount: roundMoney(movedCommission),
        existingMatchId: null,
        existingApplied: false,
      })
    }
  }

  return transformed
}

async function loadBaseSchedule(
  tx: Prisma.TransactionClient,
  params: {
    tenantId: string
    scheduleId: string
  },
){
  const baseSchedule = await tx.revenueSchedule.findFirst({
    where: { tenantId: params.tenantId, id: params.scheduleId, deletedAt: null },
    select: {
      id: true,
      accountId: true,
      opportunityId: true,
      opportunityProductId: true,
      distributorAccountId: true,
      vendorAccountId: true,
      productId: true,
      scheduleDate: true,
      scheduleNumber: true,
      vendor: {
        select: {
          accountName: true,
        },
      },
      distributor: {
        select: {
          accountName: true,
        },
      },
      product: {
        select: {
          productCode: true,
          partNumberVendor: true,
          partNumberDistributor: true,
          partNumberHouse: true,
          revenueType: true,
          productNameVendor: true,
          productFamilyHouse: true,
          productNameHouse: true,
        },
      },
    },
  })

  if (!baseSchedule) {
    throw new Error("Revenue schedule not found")
  }

  return baseSchedule
}

async function createFlexChildSchedule(
  tx: Prisma.TransactionClient,
  params: {
    tenantId: string
    scheduleId: string
    splitUsage: number
    splitCommission: number
  },
): Promise<{ scheduleId: string } & ResolutionMutationArtifacts> {
  const baseSchedule = await loadBaseSchedule(tx, {
    tenantId: params.tenantId,
    scheduleId: params.scheduleId,
  })

  const createdSchedule = await tx.revenueSchedule.create({
    data: {
      tenantId: params.tenantId,
      opportunityId: baseSchedule.opportunityId ?? null,
      opportunityProductId: baseSchedule.opportunityProductId ?? null,
      parentRevenueScheduleId: baseSchedule.id,
      accountId: baseSchedule.accountId,
      productId: baseSchedule.productId,
      distributorAccountId: baseSchedule.distributorAccountId,
      vendorAccountId: baseSchedule.vendorAccountId,
      scheduleDate: baseSchedule.scheduleDate,
      scheduleType: RevenueScheduleType.OneTime,
      expectedUsage: roundMoney(params.splitUsage),
      expectedCommission: roundMoney(params.splitCommission),
      flexClassification: RevenueScheduleFlexClassification.FlexProduct,
      flexReasonCode: RevenueScheduleFlexReasonCode.OverageOutsideTolerance,
      scheduleNumber: await generateChildRevenueScheduleName(tx as any, baseSchedule.id),
    } as any,
    select: { id: true },
  })

  return {
    scheduleId: createdSchedule.id,
    createdRevenueScheduleIds: [createdSchedule.id],
    createdOpportunityProductIds: [],
    createdProductIds: [],
    createdAdjustmentIds: [],
    affectedRevenueScheduleIds: [baseSchedule.id, createdSchedule.id],
    resolutionType: "flex_child",
  }
}

async function createAdjustmentForSchedule(
  tx: Prisma.TransactionClient,
  params: {
    tenantId: string
    scheduleId: string
    matchGroupId: string
    depositId: string
    usageAmount: number
    commissionAmount: number
    applicationScope: "this_schedule_only" | "forward_adjustment"
    createdById: string
  },
) {
  const baseSchedule = await loadBaseSchedule(tx, {
    tenantId: params.tenantId,
    scheduleId: params.scheduleId,
  })
  const adjustmentType = params.applicationScope === "forward_adjustment" ? "adjustment_forward" : "adjustment_single"
  const isBonusLike = isBonusLikeProduct({
    revenueType: baseSchedule.product?.revenueType ?? null,
    productFamilyHouse: baseSchedule.product?.productFamilyHouse ?? null,
    productNameHouse: baseSchedule.product?.productNameHouse ?? null,
  })

  return createRevenueScheduleAdjustment(tx, {
    tenantId: params.tenantId,
    revenueScheduleId: baseSchedule.id,
    matchGroupId: params.matchGroupId,
    sourceDepositId: params.depositId,
    adjustmentType,
    applicationScope: params.applicationScope,
    usageAmount: params.usageAmount,
    commissionAmount: params.commissionAmount,
    effectiveScheduleDate: baseSchedule.scheduleDate ?? null,
    reason: isBonusLike ? "Bonus variance adjustment" : "Usage variance adjustment",
    createdById: params.createdById,
  })
}

async function applyForwardAdjustments(
  tx: Prisma.TransactionClient,
  params: {
    tenantId: string
    scheduleId: string
    matchGroupId: string
    depositId: string
    usageAmount: number
    commissionAmount: number
    createdById: string
  },
): Promise<ResolutionMutationArtifacts> {
  const baseSchedule = await loadBaseSchedule(tx, {
    tenantId: params.tenantId,
    scheduleId: params.scheduleId,
  })

  const affectedScheduleIds = [baseSchedule.id]
  const createdAdjustmentIds: string[] = []

  const currentAdjustment = await createAdjustmentForSchedule(tx, {
    tenantId: params.tenantId,
    scheduleId: baseSchedule.id,
    matchGroupId: params.matchGroupId,
    depositId: params.depositId,
    usageAmount: params.usageAmount,
    commissionAmount: params.commissionAmount,
    applicationScope: "this_schedule_only",
    createdById: params.createdById,
  })
  if (currentAdjustment?.id) {
    createdAdjustmentIds.push(currentAdjustment.id)
  }

  if (baseSchedule.scheduleDate) {
    const futureSchedules = await findFutureSchedulesInScope(tx, {
      tenantId: params.tenantId,
      baseScheduleId: baseSchedule.id,
      baseScheduleDate: baseSchedule.scheduleDate,
      scope: resolveScheduleScopeKey({
        accountId: baseSchedule.accountId,
        opportunityProductId: baseSchedule.opportunityProductId,
        productId: baseSchedule.productId,
        vendorAccountId: baseSchedule.vendorAccountId,
        distributorAccountId: baseSchedule.distributorAccountId,
        vendor: baseSchedule.vendor ?? null,
        distributor: baseSchedule.distributor ?? null,
        product: baseSchedule.product ?? null,
      }),
      excludeAllocated: true,
    })

    for (const futureSchedule of futureSchedules) {
      const created = await createAdjustmentForSchedule(tx, {
        tenantId: params.tenantId,
        scheduleId: futureSchedule.id,
        matchGroupId: params.matchGroupId,
        depositId: params.depositId,
        usageAmount: params.usageAmount,
        commissionAmount: params.commissionAmount,
        applicationScope: "forward_adjustment",
        createdById: params.createdById,
      })
      if (created?.id) {
        createdAdjustmentIds.push(created.id)
      }
      affectedScheduleIds.push(futureSchedule.id)
    }
  }

  return {
    createdRevenueScheduleIds: [],
    createdOpportunityProductIds: [],
    createdProductIds: [],
    createdAdjustmentIds,
    affectedRevenueScheduleIds: affectedScheduleIds,
    resolutionType: "adjustment_forward",
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { depositId: string } },
) {
  return withPermissions(request, ["reconciliation.manage"], async req => {
    const depositId = params?.depositId?.trim()
    const tenantId = req.user.tenantId

    if (!depositId) {
      return createErrorResponse("depositId is required", 400)
    }

    const body = (await request.json().catch(() => null)) as ApplyRequestBody | null
    if (!body) {
      return createErrorResponse("Request body is required", 400)
    }
    if (!body.matchType) {
      return createErrorResponse("matchType is required", 400)
    }
    if (!Array.isArray(body.lineIds) || body.lineIds.length === 0) {
      return createErrorResponse("lineIds is required", 400)
    }
    if (!Array.isArray(body.scheduleIds) || body.scheduleIds.length === 0) {
      return createErrorResponse("scheduleIds is required", 400)
    }

    const preview = await buildMatchGroupPreview(prisma, {
      tenantId,
      depositId,
      matchType: body.matchType,
      lineIds: body.lineIds,
      scheduleIds: body.scheduleIds,
      allocations: body.allocations,
    })

    if (!preview.ok) {
      return NextResponse.json({ error: "Preview validation failed", issues: preview.issues }, { status: 400 })
    }

    const requestedResolutions = normalizeVarianceResolutionInput(body.varianceResolutions)
    const resolutionByScheduleId = new Map(requestedResolutions.map(item => [item.scheduleId, item.action]))
    const unresolvedVariancePrompts = preview.variancePrompts.filter(prompt => !resolutionByScheduleId.has(prompt.scheduleId))
    if (unresolvedVariancePrompts.length > 0) {
      return NextResponse.json(
        {
          error: "Variance resolution required",
          data: {
            requiresVarianceResolution: true,
            variancePrompts: preview.variancePrompts,
            preview,
          },
        },
        { status: 409 },
      )
    }

    for (const prompt of preview.variancePrompts) {
      const selectedAction = resolutionByScheduleId.get(prompt.scheduleId)
      if (!selectedAction) continue
      if (!prompt.allowedPromptOptions.includes(selectedAction)) {
        return createErrorResponse(`Invalid variance resolution selected for schedule ${prompt.scheduleNumber}`, 400)
      }
    }

    const baseAllocations = preview.normalizedAllocations.filter(
      allocation => allocation.usageAmount !== 0 || allocation.commissionAmount !== 0,
    )
    if (baseAllocations.length === 0) {
      return NextResponse.json({ error: "No non-zero allocations provided." }, { status: 400 })
    }

    const varianceTolerance = await getTenantVarianceTolerance(tenantId)
    const ipAddress = getClientIP(request)
    const userAgent = getUserAgent(request)

    const result = await prisma.$transaction(async tx => {
      const transformedAllocations = [...preview.normalizedAllocations]
      const resolutionArtifacts: ResolutionMutationArtifacts = {
        createdRevenueScheduleIds: [],
        createdOpportunityProductIds: [],
        createdProductIds: [],
        createdAdjustmentIds: [],
        affectedRevenueScheduleIds: [],
        resolutionType: null,
      }
      const resolutionTypes = new Set<string>()

      const group = await tx.depositMatchGroup.create({
        data: {
          tenantId,
          depositId,
          matchType: body.matchType as unknown as DepositMatchType,
          status: DepositMatchGroupStatus.Applied,
          createdByUserId: req.user.id,
        },
        select: { id: true, matchType: true, status: true, createdAt: true },
      })

      for (const prompt of preview.variancePrompts) {
        const action = resolutionByScheduleId.get(prompt.scheduleId)
        if (!action) continue

        const allocationsForSchedule = transformedAllocations.filter(
          allocation =>
            allocation.scheduleId === prompt.scheduleId &&
            (!isEffectivelyZero(allocation.usageAmount) || !isEffectivelyZero(allocation.commissionAmount)),
        )
        const totalUsageAvailable = roundMoney(
          allocationsForSchedule.reduce((sum, allocation) => sum + toNumber(allocation.usageAmount), 0),
        )
        const totalCommissionAvailable = roundMoney(
          allocationsForSchedule.reduce((sum, allocation) => sum + toNumber(allocation.commissionAmount), 0),
        )

        if (prompt.usageOverage > totalUsageAvailable + 0.01 || prompt.commissionOverage > totalCommissionAvailable + 0.01) {
          throw new Error(
            `Unable to resolve variance for ${prompt.scheduleNumber} because the selected grouped allocations do not cover the full overage`,
          )
        }

        if (action === "FlexChild") {
          const created = await createFlexChildSchedule(tx, {
            tenantId,
            scheduleId: prompt.scheduleId,
            splitUsage: prompt.usageOverage,
            splitCommission: prompt.commissionOverage,
          })

          resolutionArtifacts.createdRevenueScheduleIds.push(...created.createdRevenueScheduleIds)
          resolutionArtifacts.createdOpportunityProductIds.push(...created.createdOpportunityProductIds)
          resolutionArtifacts.createdProductIds.push(...created.createdProductIds)
          resolutionArtifacts.affectedRevenueScheduleIds.push(...created.affectedRevenueScheduleIds)
          resolutionTypes.add(created.resolutionType ?? "flex_child")

          const untouchedAllocations = transformedAllocations.filter(allocation => allocation.scheduleId !== prompt.scheduleId)
          const redistributedAllocations = distributeResolvedAllocation({
            allocations: allocationsForSchedule,
            splitUsage: prompt.usageOverage,
            splitCommission: prompt.commissionOverage,
            childScheduleId: created.scheduleId,
          })

          transformedAllocations.length = 0
          transformedAllocations.push(...untouchedAllocations, ...redistributedAllocations)
          continue
        }

        if (action === "AdjustCurrentAndFuture") {
          const created = await applyForwardAdjustments(tx, {
            tenantId,
            scheduleId: prompt.scheduleId,
            matchGroupId: group.id,
            depositId,
            usageAmount: prompt.usageOverage,
            commissionAmount: prompt.commissionOverage,
            createdById: req.user.id,
          })
          resolutionArtifacts.createdAdjustmentIds.push(...created.createdAdjustmentIds)
          resolutionArtifacts.affectedRevenueScheduleIds.push(...created.affectedRevenueScheduleIds)
          resolutionTypes.add(created.resolutionType ?? "adjustment_forward")
          continue
        }

        const createdAdjustment = await createAdjustmentForSchedule(tx, {
          tenantId,
          scheduleId: prompt.scheduleId,
          matchGroupId: group.id,
          depositId,
          usageAmount: prompt.usageOverage,
          commissionAmount: prompt.commissionOverage,
          applicationScope: "this_schedule_only",
          createdById: req.user.id,
        })
        if (createdAdjustment?.id) {
          resolutionArtifacts.createdAdjustmentIds.push(createdAdjustment.id)
        }
        resolutionArtifacts.affectedRevenueScheduleIds.push(prompt.scheduleId)
        resolutionTypes.add("adjustment_single")
      }

      resolutionArtifacts.resolutionType =
        resolutionTypes.size === 1 ? Array.from(resolutionTypes)[0] ?? null : resolutionTypes.size > 1 ? "mixed" : null

      const allocationsToPersist = transformedAllocations.filter(
        allocation => !isEffectivelyZero(allocation.usageAmount) || !isEffectivelyZero(allocation.commissionAmount),
      )
      const scheduleIdsToRecompute = Array.from(
        new Set([
          ...preview.scheduleIds,
          ...transformedAllocations.map(allocation => allocation.scheduleId),
          ...resolutionArtifacts.createdRevenueScheduleIds,
          ...resolutionArtifacts.affectedRevenueScheduleIds,
        ]),
      )

      const schedulesBefore =
        scheduleIdsToRecompute.length > 0
          ? await tx.revenueSchedule.findMany({
              where: { tenantId, id: { in: scheduleIdsToRecompute } },
              select: { id: true, status: true, actualUsage: true, actualCommission: true },
            })
          : []

      const existingMatchesBefore: Array<{
        id: string
        depositLineItemId: string
        revenueScheduleId: string
        usageAmount: number
        commissionAmount: number
        status: DepositLineMatchStatus
        source: DepositLineMatchSource
        matchGroupId: string | null
      }> = []

      const existingMatchByPairKey = new Map<
        string,
        {
          id: string
          depositLineItemId: string
          revenueScheduleId: string
          usageAmount: unknown
          commissionAmount: unknown
          status: DepositLineMatchStatus
          source: DepositLineMatchSource
          matchGroupId: string | null
        }
      >()

      if (transformedAllocations.length > 0) {
        const allocationLineIds = Array.from(new Set(transformedAllocations.map(allocation => allocation.lineId)))
        const allocationScheduleIds = Array.from(new Set(transformedAllocations.map(allocation => allocation.scheduleId)))

        const existingPairs = await tx.depositLineMatch.findMany({
          where: {
            tenantId,
            depositLineItemId: { in: allocationLineIds },
            revenueScheduleId: { in: allocationScheduleIds },
          },
          select: {
            id: true,
            depositLineItemId: true,
            revenueScheduleId: true,
            usageAmount: true,
            commissionAmount: true,
            status: true,
            source: true,
            matchGroupId: true,
          },
        })

        for (const row of existingPairs) {
          existingMatchByPairKey.set(`${row.depositLineItemId}:${row.revenueScheduleId}`, row)
        }
      }

      const autoFillAuditLogIds: string[] = []
      const capturedExistingMatchKeys = new Set<string>()

      for (const allocation of transformedAllocations) {
        const pairKey = `${allocation.lineId}:${allocation.scheduleId}`
        const existing = existingMatchByPairKey.get(pairKey)
        if (existing && !capturedExistingMatchKeys.has(pairKey)) {
          capturedExistingMatchKeys.add(pairKey)
          existingMatchesBefore.push({
            id: existing.id,
            depositLineItemId: existing.depositLineItemId,
            revenueScheduleId: existing.revenueScheduleId,
            usageAmount: toNumber(existing.usageAmount),
            commissionAmount: toNumber(existing.commissionAmount),
            status: existing.status,
            source: existing.source,
            matchGroupId: existing.matchGroupId ?? null,
          })
        }

        if (isEffectivelyZero(allocation.usageAmount) && isEffectivelyZero(allocation.commissionAmount)) {
          if (existing) {
            await tx.depositLineMatch.delete({ where: { id: existing.id } })
          }
          continue
        }

        const match = await tx.depositLineMatch.upsert({
          where: {
            depositLineItemId_revenueScheduleId: {
              depositLineItemId: allocation.lineId,
              revenueScheduleId: allocation.scheduleId,
            },
          },
          create: {
            tenantId,
            depositLineItemId: allocation.lineId,
            revenueScheduleId: allocation.scheduleId,
            usageAmount: allocation.usageAmount,
            commissionAmount: allocation.commissionAmount,
            status: DepositLineMatchStatus.Applied,
            source: resolutionArtifacts.createdRevenueScheduleIds.includes(allocation.scheduleId)
              ? DepositLineMatchSource.Auto
              : DepositLineMatchSource.Manual,
            matchGroupId: group.id,
          },
          update: {
            usageAmount: allocation.usageAmount,
            commissionAmount: allocation.commissionAmount,
            status: DepositLineMatchStatus.Applied,
            source: resolutionArtifacts.createdRevenueScheduleIds.includes(allocation.scheduleId)
              ? DepositLineMatchSource.Auto
              : DepositLineMatchSource.Manual,
            matchGroupId: group.id,
          },
          select: { id: true, depositLineItemId: true, revenueScheduleId: true },
        })

        try {
          const autoFill = await autoFillFromDepositMatch(tx, {
            tenantId,
            userId: req.user.id,
            depositId,
            depositLineItemId: match.depositLineItemId,
            revenueScheduleId: match.revenueScheduleId,
            depositLineMatchId: match.id,
            ipAddress,
            userAgent,
          })
          autoFillAuditLogIds.push(...(autoFill.auditLogIds ?? []))
        } catch (error) {
          console.error("Failed to auto-fill IDs/metadata from grouped deposit match", error)
        }
      }

      await tx.depositMatchGroup.update({
        where: { id: group.id },
        data: {
          resolutionType: resolutionArtifacts.resolutionType,
          createdRevenueScheduleIds: resolutionArtifacts.createdRevenueScheduleIds,
          createdOpportunityProductIds: resolutionArtifacts.createdOpportunityProductIds,
          createdProductIds: resolutionArtifacts.createdProductIds,
          createdAdjustmentIds: resolutionArtifacts.createdAdjustmentIds,
          affectedRevenueScheduleIds: Array.from(new Set(resolutionArtifacts.affectedRevenueScheduleIds)),
        } as any,
        select: { id: true },
      })

      const recomputedLines = []
      for (const lineId of preview.lineIds) {
        const updated = await recomputeDepositLineItemAllocations(tx, lineId, tenantId)
        recomputedLines.push(updated)
      }

      const recomputedSchedules = await recomputeRevenueSchedules(tx, scheduleIdsToRecompute, tenantId, {
        varianceTolerance,
      })

      const deposit = await recomputeDepositAggregates(tx, depositId, tenantId)

      return {
        group,
        deposit,
        lines: recomputedLines,
        schedules: recomputedSchedules,
        schedulesBefore,
        autoFillAuditLogIds,
        existingMatchesBefore,
        resolutionArtifacts,
        appliedAllocationCount: allocationsToPersist.length,
      }
    })

    await logMatchingMetric({
      tenantId,
      userId: req.user.id,
      event: "manual_match",
      depositId,
      request,
      metadata: {
        matchGroupId: result.group.id,
        matchType: String(preview.matchType),
        lineCount: preview.lineIds.length,
        scheduleCount: preview.scheduleIds.length,
        allocationCount: result.appliedAllocationCount,
      },
    })

    for (const scheduleResult of result.schedules ?? []) {
      const before = (result.schedulesBefore ?? []).find(row => row.id === scheduleResult.schedule.id)
      await logRevenueScheduleAudit(
        AuditAction.Update,
        scheduleResult.schedule.id,
        req.user.id,
        tenantId,
        request,
        {
          status: before?.status ?? null,
          actualUsage: before?.actualUsage ?? null,
          actualCommission: before?.actualCommission ?? null,
        },
        {
          action: "ApplyMatchGroup",
          depositId,
          matchGroupId: result.group.id,
          status: scheduleResult.schedule.status,
          actualUsage: scheduleResult.schedule.actualUsage,
          actualCommission: scheduleResult.schedule.actualCommission,
          usageBalance: scheduleResult.usageBalance,
          commissionDifference: scheduleResult.commissionDifference,
          matchCount: scheduleResult.matchCount,
        },
      )
    }

    await logAudit({
      userId: req.user.id,
      tenantId,
      action: AuditAction.Create,
      entityName: "DepositMatchGroup",
      entityId: result.group.id,
      ipAddress,
      userAgent,
      metadata: {
        action: "ApplyMatchGroup",
        depositId,
        matchGroupId: result.group.id,
        matchType: String(preview.matchType),
        lineIds: preview.lineIds,
        scheduleIds: preview.scheduleIds,
        allocationCount: result.appliedAllocationCount,
        existingMatchCount: (result as any).existingMatchesBefore?.length ?? 0,
        existingMatchesBefore: (result as any).existingMatchesBefore ?? [],
        autoFillAuditLogIds: (result as any).autoFillAuditLogIds ?? [],
        resolutionType: (result as any).resolutionArtifacts?.resolutionType ?? null,
        createdRevenueScheduleIds: (result as any).resolutionArtifacts?.createdRevenueScheduleIds ?? [],
        createdOpportunityProductIds: (result as any).resolutionArtifacts?.createdOpportunityProductIds ?? [],
        createdProductIds: (result as any).resolutionArtifacts?.createdProductIds ?? [],
        createdAdjustmentIds: (result as any).resolutionArtifacts?.createdAdjustmentIds ?? [],
        affectedRevenueScheduleIds: (result as any).resolutionArtifacts?.affectedRevenueScheduleIds ?? [],
        varianceResolutions: requestedResolutions,
      },
    })

    const { schedulesBefore: _schedulesBefore, existingMatchesBefore: _existingMatchesBefore, ...responseData } =
      result as any
    return NextResponse.json({ data: responseData })
  })
}
