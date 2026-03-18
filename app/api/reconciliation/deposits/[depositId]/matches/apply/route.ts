import { randomUUID } from "crypto"
import { NextRequest, NextResponse } from "next/server"
import {
  AuditAction,
  DepositLineMatchSource,
  DepositLineMatchStatus,
  DepositMatchGroupStatus,
  DepositMatchType,
  RevenueScheduleBillingStatus,
  RevenueScheduleBillingStatusSource,
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

type ApplyRequestBody = {
  matchType: MatchSelectionType
  lineIds: string[]
  scheduleIds: string[]
  allocations?: MatchGroupAllocationInput[] | null
  varianceResolutions?: Array<{
    scheduleId: string
    action: "Adjust" | "FlexProduct"
  }> | null
}

function toNumber(value: unknown): number {
  const numeric = Number(value ?? 0)
  return Number.isFinite(numeric) ? numeric : 0
}

const EPSILON = 0.005

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

function isEffectivelyZero(value: number): boolean {
  return Math.abs(value) <= EPSILON
}

type NormalizedVarianceResolution = {
  scheduleId: string
  action: "Adjust" | "FlexProduct"
}

function normalizeVarianceResolutionInput(value: ApplyRequestBody["varianceResolutions"]): NormalizedVarianceResolution[] {
  if (!Array.isArray(value)) return []
  const out: NormalizedVarianceResolution[] = []
  for (const item of value) {
    const scheduleId = typeof item?.scheduleId === "string" ? item.scheduleId.trim() : ""
    const action = item?.action
    if (!scheduleId || (action !== "Adjust" && action !== "FlexProduct")) continue
    out.push({ scheduleId, action })
  }
  return out
}

type ResolutionMutationArtifacts = {
  createdRevenueScheduleIds: string[]
  createdOpportunityProductIds: string[]
  createdProductIds: string[]
}

type TransformedAllocation = MatchGroupPreviewAllocation

function buildFlexProductScheduleNumber(parentScheduleNumber: string | null | undefined, fallbackId: string): string {
  const trimmedParent = typeof parentScheduleNumber === "string" ? parentScheduleNumber.trim() : ""
  const base = trimmedParent || fallbackId.trim() || fallbackId
  return `FLEX-${base}`
}

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

async function createResolutionSchedule(
  tx: Prisma.TransactionClient,
  params: {
    tenantId: string
    scheduleId: string
    action: "Adjust" | "FlexProduct"
    splitUsage: number
    splitCommission: number
  },
): Promise<{ scheduleId: string } & ResolutionMutationArtifacts> {
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
      product: {
        select: {
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

  if (params.action === "Adjust") {
    const isBonusLike = isBonusLikeProduct({
      revenueType: baseSchedule.product?.revenueType ?? null,
      productFamilyHouse: baseSchedule.product?.productFamilyHouse ?? null,
      productNameHouse: baseSchedule.product?.productNameHouse ?? null,
    })
    const flexClassification = isBonusLike
      ? RevenueScheduleFlexClassification.Bonus
      : RevenueScheduleFlexClassification.Adjustment
    const flexReasonCode = isBonusLike
      ? RevenueScheduleFlexReasonCode.BonusVariance
      : RevenueScheduleFlexReasonCode.OverageOutsideTolerance

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
        flexClassification,
        flexReasonCode,
        scheduleNumber: await generateChildRevenueScheduleName(tx as any, baseSchedule.id),
        billingStatus: RevenueScheduleBillingStatus.Open,
        billingStatusSource: RevenueScheduleBillingStatusSource.Auto,
        billingStatusUpdatedAt: new Date(),
        billingStatusReason: `AutoFlexCreate:${String(flexClassification)}`,
      } as any,
      select: { id: true },
    })

    return {
      scheduleId: createdSchedule.id,
      createdRevenueScheduleIds: [createdSchedule.id],
      createdOpportunityProductIds: [],
      createdProductIds: [],
    }
  }

  const createdProduct = await tx.product.create({
    data: {
      tenantId: params.tenantId,
      productCode: `FLEX-${randomUUID().slice(0, 8).toUpperCase()}`,
      productNameHouse: "Flex Product",
      productNameVendor: baseSchedule.product?.productNameVendor ?? "Flex Product",
      revenueType: baseSchedule.product?.revenueType ?? "MRC_ThirdParty",
      isActive: true,
      isFlex: true,
      flexAccountId: baseSchedule.accountId,
      flexType: "FlexProduct",
      vendorAccountId: baseSchedule.vendorAccountId,
      distributorAccountId: baseSchedule.distributorAccountId,
    } as any,
    select: { id: true },
  })

  const createdOpportunityProduct = baseSchedule.opportunityId
    ? await tx.opportunityProduct.create({
        data: {
          tenantId: params.tenantId,
          opportunityId: baseSchedule.opportunityId,
          productId: createdProduct.id,
          distributorAccountIdSnapshot: baseSchedule.distributorAccountId ?? null,
          vendorAccountIdSnapshot: baseSchedule.vendorAccountId ?? null,
          expectedUsage: roundMoney(params.splitUsage),
          expectedCommission: roundMoney(params.splitCommission),
        },
        select: { id: true },
      })
    : null

  const createdSchedule = await tx.revenueSchedule.create({
    data: {
      tenantId: params.tenantId,
      opportunityId: baseSchedule.opportunityId ?? null,
      opportunityProductId: createdOpportunityProduct?.id ?? null,
      parentRevenueScheduleId: baseSchedule.id,
      accountId: baseSchedule.accountId,
      productId: createdProduct.id,
      distributorAccountId: baseSchedule.distributorAccountId,
      vendorAccountId: baseSchedule.vendorAccountId,
      scheduleDate: baseSchedule.scheduleDate,
      scheduleType: RevenueScheduleType.OneTime,
      expectedUsage: roundMoney(params.splitUsage),
      expectedCommission: roundMoney(params.splitCommission),
      flexClassification: RevenueScheduleFlexClassification.FlexProduct,
      flexReasonCode: RevenueScheduleFlexReasonCode.OverageOutsideTolerance,
      scheduleNumber: buildFlexProductScheduleNumber(baseSchedule.scheduleNumber, baseSchedule.id),
      billingStatus: RevenueScheduleBillingStatus.InDispute,
      billingStatusSource: RevenueScheduleBillingStatusSource.Auto,
      billingStatusUpdatedAt: new Date(),
      billingStatusReason: `AutoFlexCreate:${String(RevenueScheduleFlexClassification.FlexProduct)}`,
    } as any,
    select: { id: true },
  })

  return {
    scheduleId: createdSchedule.id,
    createdRevenueScheduleIds: [createdSchedule.id],
    createdOpportunityProductIds: createdOpportunityProduct ? [createdOpportunityProduct.id] : [],
    createdProductIds: [createdProduct.id],
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
      }

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

        const created = await createResolutionSchedule(tx, {
          tenantId,
          scheduleId: prompt.scheduleId,
          action,
          splitUsage: prompt.usageOverage,
          splitCommission: prompt.commissionOverage,
        })

        resolutionArtifacts.createdRevenueScheduleIds.push(...created.createdRevenueScheduleIds)
        resolutionArtifacts.createdOpportunityProductIds.push(...created.createdOpportunityProductIds)
        resolutionArtifacts.createdProductIds.push(...created.createdProductIds)

        const untouchedAllocations = transformedAllocations.filter(allocation => allocation.scheduleId !== prompt.scheduleId)
        const redistributedAllocations = distributeResolvedAllocation({
          allocations: allocationsForSchedule,
          splitUsage: prompt.usageOverage,
          splitCommission: prompt.commissionOverage,
          childScheduleId: created.scheduleId,
        })

        transformedAllocations.length = 0
        transformedAllocations.push(...untouchedAllocations, ...redistributedAllocations)
      }

      const allocationsToPersist = transformedAllocations.filter(
        allocation => !isEffectivelyZero(allocation.usageAmount) || !isEffectivelyZero(allocation.commissionAmount),
      )
      const scheduleIdsToRecompute = Array.from(
        new Set([
          ...preview.scheduleIds,
          ...transformedAllocations.map(allocation => allocation.scheduleId),
          ...resolutionArtifacts.createdRevenueScheduleIds,
        ]),
      )

      const schedulesBefore =
        scheduleIdsToRecompute.length > 0
          ? await tx.revenueSchedule.findMany({
              where: { tenantId, id: { in: scheduleIdsToRecompute } },
              select: { id: true, status: true, actualUsage: true, actualCommission: true },
            })
          : []

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
        createdRevenueScheduleIds: (result as any).resolutionArtifacts?.createdRevenueScheduleIds ?? [],
        createdOpportunityProductIds: (result as any).resolutionArtifacts?.createdOpportunityProductIds ?? [],
        createdProductIds: (result as any).resolutionArtifacts?.createdProductIds ?? [],
        varianceResolutions: requestedResolutions,
      },
    })

    const { schedulesBefore: _schedulesBefore, existingMatchesBefore: _existingMatchesBefore, ...responseData } =
      result as any
    return NextResponse.json({ data: responseData })
  })
}
