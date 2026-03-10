import { createHash } from "node:crypto"

import { NextRequest, NextResponse } from "next/server"
import {
  AuditAction,
  DepositLineItemStatus,
  DepositLineMatchStatus,
  Prisma,
  RevenueScheduleStatus,
} from "@prisma/client"

import { prisma } from "@/lib/db"
import { withPermissions, createErrorResponse } from "@/lib/api-auth"
import { generateRevenueScheduleName } from "@/lib/revenue-schedule-number"
import { getClientIP, getUserAgent } from "@/lib/audit"
import {
  analyzeBundleLineRates,
  formatRatePercentFromFraction,
  roundMoney,
  toNumber,
} from "@/lib/matching/bundle-replacement"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type BundleApplyMode = "keep_old" | "soft_delete_old"

type LineToScheduleMapRow = { lineId: string; scheduleId: string }

class BundleApplyError extends Error {
  readonly status: number
  readonly details: unknown

  constructor(message: string, status: number, details?: unknown) {
    super(message)
    this.name = "BundleApplyError"
    this.status = status
    this.details = details ?? null
  }
}

type BundleApplyBody = {
  lineIds: string[]
  revenueScheduleId: string
  mode?: BundleApplyMode
  reason?: string | null
  simulateFailureStep?: "after_first_replacement_product" | null
}

function computeBundleIdempotencyKey(params: {
  depositId: string
  revenueScheduleId: string
  mode: BundleApplyMode
  lineIdsSorted: string[]
}): string {
  const canonical = JSON.stringify({
    v: 1,
    depositId: params.depositId,
    revenueScheduleId: params.revenueScheduleId,
    mode: params.mode,
    lineIds: params.lineIdsSorted,
  })

  return createHash("sha256").update(canonical).digest("hex")
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map(item => (typeof item === "string" ? item.trim() : ""))
    .filter(item => item.length > 0)
}

function parseLineToScheduleMap(value: unknown): LineToScheduleMapRow[] {
  if (!Array.isArray(value)) return []
  const mapped: LineToScheduleMapRow[] = []
  for (const item of value) {
    if (!item || typeof item !== "object") continue
    const lineId = typeof (item as any).lineId === "string" ? (item as any).lineId.trim() : ""
    const scheduleId = typeof (item as any).scheduleId === "string" ? (item as any).scheduleId.trim() : ""
    if (!lineId || !scheduleId) continue
    mapped.push({ lineId, scheduleId })
  }
  return mapped
}

function formatDateOnly(value: Date | null | undefined): string {
  if (!value) return ""
  return value.toISOString().split("T")[0] ?? ""
}

function buildBundleProductCode(params: { depositId: string; lineId: string; suffix: number }) {
  const stamp = Date.now()
  const depositToken = params.depositId.replace(/[^a-z0-9]/gi, "").slice(0, 8) || "dep"
  const lineToken = params.lineId.replace(/[^a-z0-9]/gi, "").slice(0, 8) || "line"
  return `BUNDLE_${depositToken}_${lineToken}_${params.suffix}_${stamp}`
}

function buildScheduleRows(matchSchedules: any[]) {
  return matchSchedules.map(schedule => {
    const expectedUsage = roundMoney(toNumber((schedule as any).expectedUsage))
    const usageAdjustment = roundMoney(toNumber((schedule as any).usageAdjustment))
    const expectedUsageNet = roundMoney(expectedUsage + usageAdjustment)
    const actualUsage = roundMoney(toNumber((schedule as any).actualUsage) + toNumber((schedule as any).actualUsageAdjustment))

    const expectedCommission = roundMoney(toNumber((schedule as any).expectedCommission))
    const expectedCommissionAdjustment = roundMoney(
      toNumber((schedule as any).expectedCommissionAdjustment ?? (schedule as any).actualCommissionAdjustment),
    )
    const expectedCommissionNet = roundMoney(expectedCommission + expectedCommissionAdjustment)
    const actualCommission = roundMoney(toNumber((schedule as any).actualCommission) + toNumber((schedule as any).actualCommissionAdjustment))

    const expectedCommissionRatePercent = expectedUsageNet !== 0 ? expectedCommissionNet / expectedUsageNet : 0
    const actualCommissionRatePercent = actualUsage !== 0 ? actualCommission / actualUsage : 0

    const dateText = formatDateOnly((schedule as any).scheduleDate ?? null)
    return {
      id: schedule.id,
      status: "Unmatched" as const,
      lineItem: 0,
      matchConfidence: 1,
      vendorName: (schedule as any).vendor?.accountName ?? "",
      legalName: (schedule as any).account?.accountLegalName ?? (schedule as any).account?.accountName ?? "",
      productNameVendor: (schedule as any).product?.productNameVendor ?? (schedule as any).product?.productNameHouse ?? "",
      revenueScheduleDate: dateText,
      revenueScheduleName: (schedule as any).scheduleNumber ?? schedule.id,
      quantity: 1,
      priceEach: expectedUsage,
      expectedUsageGross: expectedUsage,
      expectedUsageAdjustment: usageAdjustment,
      expectedUsageNet,
      actualUsage,
      usageBalance: roundMoney(expectedUsageNet - actualUsage),
      paymentDate: dateText,
      expectedCommissionGross: expectedCommission,
      expectedCommissionAdjustment,
      expectedCommissionNet,
      actualCommission,
      commissionDifference: roundMoney(expectedCommissionNet - actualCommission),
      expectedCommissionRatePercent,
      actualCommissionRatePercent,
      commissionRateDifference: expectedCommissionRatePercent - actualCommissionRatePercent,
    }
  })
}

async function buildBundleApplyResponseFromOperation(client: any, params: { tenantId: string; operation: any }) {
  const createdRevenueScheduleIds = parseStringArray(params.operation.createdRevenueScheduleIds)
  const replacedRevenueScheduleIds = parseStringArray(params.operation.replacedRevenueScheduleIds)
  const lineToScheduleMap = parseLineToScheduleMap(params.operation.lineToScheduleMap)
  const matchScheduleIds = Array.from(new Set(lineToScheduleMap.map(row => row.scheduleId))).filter(Boolean)

  if (!params.operation.applyAuditLogId || createdRevenueScheduleIds.length === 0 || lineToScheduleMap.length === 0) {
    throw new BundleApplyError("Bundle operation record is incomplete. Please contact support.", 409, {
      code: "BUNDLE_OPERATION_INCOMPLETE",
      bundleOperationId: params.operation.id,
    })
  }

  const matchSchedules = matchScheduleIds.length
    ? await client.revenueSchedule.findMany({
        where: { tenantId: params.tenantId, id: { in: matchScheduleIds }, deletedAt: null } as any,
        include: {
          account: { select: { accountName: true, accountLegalName: true } },
          vendor: { select: { accountName: true } },
          product: { select: { productNameVendor: true, productNameHouse: true } },
        },
        orderBy: [{ scheduleDate: "asc" }, { createdAt: "asc" }],
      })
    : []

  return {
    bundleAuditLogId: params.operation.applyAuditLogId,
    scheduleRows: buildScheduleRows(matchSchedules),
    lineToScheduleMap,
    createdRevenueScheduleIds,
    replacedScheduleIds: replacedRevenueScheduleIds,
    replacementMode: params.operation.mode ?? "keep_old",
  }
}

export async function POST(request: NextRequest, { params }: { params: { depositId: string } }) {
  return withPermissions(request, ["reconciliation.manage"], async req => {
    const depositId = params?.depositId?.trim()
    const tenantId = req.user.tenantId
    const ipAddress = getClientIP(request)
    const userAgent = getUserAgent(request)

    if (!depositId) {
      return createErrorResponse("depositId is required", 400)
    }

    const body = (await request.json().catch(() => null)) as BundleApplyBody | null
    if (!body || typeof body !== "object") {
      return createErrorResponse("Request body is required", 400)
    }

    const lineIds = Array.isArray(body.lineIds)
      ? body.lineIds.map(id => (typeof id === "string" ? id.trim() : "")).filter(Boolean)
      : []

    const revenueScheduleId = typeof body.revenueScheduleId === "string" ? body.revenueScheduleId.trim() : ""
    const mode = body.mode === "soft_delete_old" ? "soft_delete_old" : "keep_old"
    const reason = typeof body.reason === "string" ? body.reason.trim() : null
    const simulateFailureStep =
      body.simulateFailureStep === "after_first_replacement_product" ? body.simulateFailureStep : null

    if (lineIds.length < 2) {
      return createErrorResponse("Bundle requires at least two deposit line items", 400)
    }
    if (!revenueScheduleId) {
      return createErrorResponse("revenueScheduleId is required", 400)
    }

    const lineIdsSorted = [...lineIds].sort((a, b) => a.localeCompare(b))
    const idempotencyKey = computeBundleIdempotencyKey({ depositId, revenueScheduleId, mode, lineIdsSorted })

    try {
      const result = await prisma.$transaction(async tx => {
        const existingOperation = await (tx as any).bundleOperation.findFirst({
          where: { tenantId, idempotencyKey, undoneAt: null },
          select: {
            id: true,
            applyAuditLogId: true,
            createdRevenueScheduleIds: true,
            replacedRevenueScheduleIds: true,
            lineToScheduleMap: true,
            mode: true,
          },
        })

        if (existingOperation) {
          return buildBundleApplyResponseFromOperation(tx, { tenantId, operation: existingOperation })
        }

      const baseSchedule = await tx.revenueSchedule.findFirst({
        where: { tenantId, id: revenueScheduleId, deletedAt: null } as any,
        select: {
          id: true,
          accountId: true,
          opportunityId: true,
          opportunityProductId: true,
          productId: true,
          scheduleDate: true,
          scheduleType: true,
          distributorAccountId: true,
          vendorAccountId: true,
        },
      })

       if (!baseSchedule) {
         throw new BundleApplyError("Revenue schedule not found", 404)
       }
       if (!baseSchedule.opportunityId || !baseSchedule.opportunityProductId) {
         throw new BundleApplyError(
           "Selected schedule is not linked to an opportunity product; bundle is not supported here.",
           400,
         )
       }
       if (!baseSchedule.scheduleDate) {
         throw new BundleApplyError("Selected schedule is missing scheduleDate; bundle is not supported here.", 400)
       }

      const deposit = await tx.deposit.findFirst({
        where: { tenantId, id: depositId },
        select: { id: true },
      })
       if (!deposit) {
         throw new BundleApplyError("Deposit not found", 404)
       }

       const lines = await tx.depositLineItem.findMany({
         where: { tenantId, depositId, id: { in: lineIds } },
         select: {
            id: true,
            lineNumber: true,
            status: true,
            reconciled: true,
            accountIdVendor: true,
            customerIdVendor: true,
            orderIdVendor: true,
            accountNameRaw: true,
            productNameRaw: true,
            partNumberRaw: true,
            locationId: true,
            customerPurchaseOrder: true,
            metadata: true,
            usage: true,
            commission: true,
            usageUnallocated: true,
            commissionUnallocated: true,
            commissionRate: true,
         },
       })

        if (lines.length !== lineIds.length) {
          throw new BundleApplyError("One or more deposit line items could not be found for this deposit.", 400)
        }

       const appliedMatches = await tx.depositLineMatch.findMany({
         where: {
           tenantId,
           depositLineItemId: { in: lineIds },
           status: DepositLineMatchStatus.Applied,
         },
         select: { depositLineItemId: true },
       })
       const appliedLineIds = Array.from(new Set(appliedMatches.map(match => match.depositLineItemId)))
       if (appliedLineIds.length > 0) {
         throw new BundleApplyError("One or more selected deposit lines already have applied allocations.", 409, {
           code: "BUNDLE_LINES_ALREADY_APPLIED",
           lineIds: appliedLineIds,
         })
       }

       for (const line of lines) {
         if (line.reconciled) {
          throw new BundleApplyError(`Line ${line.id} is reconciled and cannot be used for bundle.`, 409)
         }
         if (line.status === DepositLineItemStatus.Ignored) {
          throw new BundleApplyError(`Line ${line.id} is ignored and cannot be used for bundle.`, 409)
         }
          const usage = toNumber(line.usageUnallocated ?? line.usage)
          const commission = toNumber(line.commissionUnallocated ?? line.commission)
          if (usage < -0.005 || commission < -0.005) {
           throw new BundleApplyError("Bundle flow does not support negative line items yet.", 409)
          }
        }

        const rateAnalysis = analyzeBundleLineRates(lines)
        const unknownRateLineIds = rateAnalysis.unknownRateLineIds
        if (unknownRateLineIds.length > 0) {
          throw new BundleApplyError(
            "We can't replace this bundle yet because one or more selected lines are missing a commission rate.",
            409,
            { code: "BUNDLE_RATE_UNKNOWN", lineIds: unknownRateLineIds },
          )
        }

        if (rateAnalysis.hasMixedRates && mode !== "soft_delete_old") {
          throw new BundleApplyError(
            "This mixed-rate bundle must be replaced with individual schedules, which retires the original bundle schedules.",
            409,
            { code: "BUNDLE_MIXED_RATE_REQUIRES_REPLACEMENT", rates: rateAnalysis.rateRows },
          )
        }

        const remainingSchedules = await tx.revenueSchedule.findMany({
          where: {
            tenantId,
            opportunityProductId: baseSchedule.opportunityProductId,
           deletedAt: null,
           scheduleDate: { gte: baseSchedule.scheduleDate },
         } as any,
        select: {
          id: true,
          scheduleDate: true,
          status: true,
          depositLineMatches: {
            where: { tenantId, status: DepositLineMatchStatus.Applied },
            select: { id: true },
            take: 1,
          },
        },
         orderBy: [{ scheduleDate: "asc" }, { createdAt: "asc" }],
       })

       const replaceTargetScheduleIds = mode === "soft_delete_old" ? remainingSchedules.map(row => row.id) : []
       if (mode === "soft_delete_old") {
         const ineligible = remainingSchedules
           .filter(row => row.status !== RevenueScheduleStatus.Unreconciled || row.depositLineMatches.length > 0)
           .map(row => ({
             scheduleId: row.id,
             status: row.status,
             hasAppliedMatches: row.depositLineMatches.length > 0,
           }))

         if (ineligible.length > 0) {
           throw new BundleApplyError(
             "One or more existing schedules cannot be safely replaced. Undo existing allocations or use keep_old.",
             409,
             { code: "BUNDLE_REPLACE_INELIGIBLE", schedules: ineligible },
           )
         }
       }

       const bundleOperation = await (tx as any).bundleOperation.create({
         data: {
           tenantId,
           depositId,
           baseRevenueScheduleId: revenueScheduleId,
           baseOpportunityProductId: baseSchedule.opportunityProductId,
           baseScheduleDate: baseSchedule.scheduleDate,
           mode,
           lineIds: lineIdsSorted,
           idempotencyKey,
           reason,
           createdProductIds: [],
           createdOpportunityProductIds: [],
           createdRevenueScheduleIds: [],
           replacedRevenueScheduleIds: [],
           lineToScheduleMap: [],
         },
         select: { id: true },
       })

       const replacedScheduleIds: string[] = []
       if (mode === "soft_delete_old" && replaceTargetScheduleIds.length > 0) {
         await tx.revenueSchedule.updateMany({
           where: { tenantId, id: { in: replaceTargetScheduleIds } },
           data: { deletedAt: new Date(), updatedById: req.user.id },
         })
         replacedScheduleIds.push(...replaceTargetScheduleIds)
       }

       const scheduleDates = Array.from(
         new Set(
           remainingSchedules
             .map(row => row.scheduleDate?.toISOString())
            .filter((value): value is string => typeof value === "string" && value.length > 0),
        ),
      )
        .map(value => new Date(value))
        .filter(date => !Number.isNaN(date.getTime()))
        .sort((a, b) => a.getTime() - b.getTime())

      const effectiveDates = scheduleDates.length > 0 ? scheduleDates : [baseSchedule.scheduleDate]
      const startDate = effectiveDates[0]!
      const endDate = effectiveDates[effectiveDates.length - 1]!

      const baseProduct = baseSchedule.productId
        ? await tx.product.findFirst({
            where: { tenantId, id: baseSchedule.productId },
            select: {
              revenueType: true,
              commissionPercent: true,
              vendorAccountId: true,
              distributorAccountId: true,
              productFamilyHouse: true,
              productSubtypeHouse: true,
              productFamilyVendor: true,
              productSubtypeVendor: true,
            },
          })
        : null

       if (!baseProduct) {
        throw new BundleApplyError("Unable to load the base product for this schedule.", 400)
       }

      const createdProductIds: string[] = []
      const createdOpportunityProductIds: string[] = []
      const createdRevenueScheduleIds: string[] = []

      const matchScheduleIds: string[] = []
      const lineToScheduleMap: Array<Record<string, unknown>> = []
      const sourceScheduleByDateKey = new Map(
        remainingSchedules
          .filter(row => row.scheduleDate)
          .map(row => [row.scheduleDate!.toISOString(), row.id]),
      )
      const rateByLineId = new Map(
        rateAnalysis.rateRows
          .filter((row): row is { lineId: string; rateFraction: number } => row.rateFraction !== null)
          .map(row => [row.lineId, row.rateFraction]),
      )

      const sortedLines = [...lines].sort((a, b) => (a.lineNumber ?? 0) - (b.lineNumber ?? 0))

      for (let index = 0; index < sortedLines.length; index++) {
        const line = sortedLines[index]!
        const usagePerSchedule = Math.max(0, roundMoney(toNumber(line.usageUnallocated ?? line.usage)))
        const commissionPerSchedule = Math.max(0, roundMoney(toNumber(line.commissionUnallocated ?? line.commission)))
        const commissionRateFraction = rateByLineId.get(line.id)

        if (commissionRateFraction == null) {
          throw new BundleApplyError("Missing commission rate for replacement line.", 409, {
            code: "BUNDLE_RATE_UNKNOWN",
            lineId: line.id,
          })
        }

        const productNameVendor = (line.productNameRaw ?? "").trim() || `Bundle Item ${index + 1}`
        const partNumberVendor = (line.partNumberRaw ?? "").trim() || null
        const commissionPercent = roundMoney(commissionRateFraction * 100)
        const metadataSummary = [
          line.accountIdVendor ? `Account ID: ${line.accountIdVendor}` : null,
          line.customerIdVendor ? `Customer ID: ${line.customerIdVendor}` : null,
          line.orderIdVendor ? `Order ID: ${line.orderIdVendor}` : null,
          line.locationId ? `Location ID: ${line.locationId}` : null,
          line.customerPurchaseOrder ? `PO: ${line.customerPurchaseOrder}` : null,
        ]
          .filter(Boolean)
          .join(" | ")
        const replacementDescription = metadataSummary
          ? `Replacement from deposit line ${line.lineNumber ?? index + 1}. ${metadataSummary}`
          : `Replacement from deposit line ${line.lineNumber ?? index + 1}.`

        const productCode = buildBundleProductCode({ depositId, lineId: line.id, suffix: index + 1 })

        const createdProduct = await tx.product.create({
          data: {
            tenantId,
            productCode,
            productNameHouse: productNameVendor,
            productNameVendor,
            description: replacementDescription,
            revenueType: baseProduct.revenueType,
            commissionPercent: new Prisma.Decimal(commissionPercent),
            priceEach: new Prisma.Decimal(usagePerSchedule),
            vendorAccountId: baseSchedule.vendorAccountId ?? baseProduct.vendorAccountId ?? null,
            distributorAccountId: baseSchedule.distributorAccountId ?? baseProduct.distributorAccountId ?? null,
            productFamilyHouse: baseProduct.productFamilyHouse ?? null,
            productSubtypeHouse: baseProduct.productSubtypeHouse ?? null,
            productFamilyVendor: baseProduct.productFamilyVendor ?? null,
            productSubtypeVendor: baseProduct.productSubtypeVendor ?? null,
            partNumberVendor,
            createdById: req.user.id,
            updatedById: req.user.id,
          } as any,
          select: { id: true, productCode: true, productNameVendor: true, partNumberVendor: true },
        })
        createdProductIds.push(createdProduct.id)

        const createdOpportunityProduct = await (tx.opportunityProduct as any).create({
          data: {
            tenantId,
            opportunityId: baseSchedule.opportunityId,
            productId: createdProduct.id,
            productCodeSnapshot: createdProduct.productCode,
            productNameHouseSnapshot: createdProduct.productNameVendor ?? productNameVendor,
            productNameVendorSnapshot: createdProduct.productNameVendor ?? productNameVendor,
            revenueTypeSnapshot: baseProduct.revenueType,
            priceEachSnapshot: new Prisma.Decimal(usagePerSchedule),
            commissionPercentSnapshot: new Prisma.Decimal(commissionPercent),
            vendorAccountIdSnapshot: baseSchedule.vendorAccountId ?? baseProduct.vendorAccountId ?? null,
            distributorAccountIdSnapshot: baseSchedule.distributorAccountId ?? baseProduct.distributorAccountId ?? null,
            descriptionSnapshot: replacementDescription,
            partNumberVendorSnapshot: createdProduct.partNumberVendor ?? null,
            quantity: new Prisma.Decimal(1),
            unitPrice: new Prisma.Decimal(usagePerSchedule),
            expectedUsage: new Prisma.Decimal(usagePerSchedule * effectiveDates.length),
            expectedCommission: new Prisma.Decimal(commissionPerSchedule * effectiveDates.length),
            revenueStartDate: startDate,
            revenueEndDate: endDate,
            active: true,
          },
          select: { id: true },
        })
        createdOpportunityProductIds.push(createdOpportunityProduct.id)

        await tx.depositLineItem.update({
          where: { id: line.id },
          data: { productId: createdProduct.id },
        })

        if (simulateFailureStep === "after_first_replacement_product" && index === 0) {
          throw new Error("Simulated replacement failure after first product creation")
        }

        for (const date of effectiveDates) {
          const scheduleNumber = await generateRevenueScheduleName(tx)
          const sourceScheduleId = sourceScheduleByDateKey.get(date.toISOString()) ?? null
          const createdSchedule = await tx.revenueSchedule.create({
            data: {
              tenantId,
              accountId: baseSchedule.accountId,
              opportunityId: baseSchedule.opportunityId,
              opportunityProductId: createdOpportunityProduct.id,
              productId: createdProduct.id,
              parentRevenueScheduleId: sourceScheduleId,
              distributorAccountId: baseSchedule.distributorAccountId,
              vendorAccountId: baseSchedule.vendorAccountId,
              scheduleNumber,
              scheduleDate: date,
              scheduleType: baseSchedule.scheduleType,
              expectedUsage: usagePerSchedule,
              usageAdjustment: 0,
              expectedCommission: commissionPerSchedule,
              expectedCommissionRatePercent: new Prisma.Decimal(commissionPercent),
              status: RevenueScheduleStatus.Unreconciled,
              isSelected: false,
              notes: replacementDescription,
              comments: metadataSummary || null,
              createdById: req.user.id,
              updatedById: req.user.id,
              actualUsage: null,
              actualUsageAdjustment: null,
              actualCommission: null,
              actualCommissionAdjustment: null,
            } as any,
            select: { id: true, scheduleDate: true },
          })
          createdRevenueScheduleIds.push(createdSchedule.id)

          if (createdSchedule.scheduleDate?.getTime() === baseSchedule.scheduleDate.getTime()) {
            matchScheduleIds.push(createdSchedule.id)
            lineToScheduleMap.push({
              lineId: line.id,
              scheduleId: createdSchedule.id,
              replacedScheduleId: sourceScheduleId,
              createdProductId: createdProduct.id,
              createdOpportunityProductId: createdOpportunityProduct.id,
              commissionRateFraction,
              commissionRatePercent: commissionPercent,
              accountIdVendor: line.accountIdVendor ?? null,
              customerIdVendor: line.customerIdVendor ?? null,
              orderIdVendor: line.orderIdVendor ?? null,
              locationId: line.locationId ?? null,
              customerPurchaseOrder: line.customerPurchaseOrder ?? null,
              metadata: line.metadata ?? null,
            })
          }
        }
      }

        if (mode === "soft_delete_old") {
          await (tx.opportunityProduct as any).update({
            where: { id: baseSchedule.opportunityProductId },
            data: {
              active: false,
              status: "BillingEnded",
            },
          })
        }

        const bundleAudit = await tx.auditLog.create({
          data: {
            tenantId,
            userId: req.user.id,
            action: AuditAction.Update,
          entityName: "Deposit",
          entityId: depositId,
          ipAddress,
          userAgent,
            metadata: {
              action: "BundleRipReplaceApply",
              depositId,
              revenueScheduleId,
              lineIds,
              mode,
              reason,
              idempotencyKey,
              mixedRateReplacement: rateAnalysis.hasMixedRates,
              lineRateSummary: rateAnalysis.rateRows.map(row => ({
                lineId: row.lineId,
                commissionRate: formatRatePercentFromFraction(row.rateFraction),
              })),
              bundleOperationId: bundleOperation.id,
              baseOpportunityProductId: baseSchedule.opportunityProductId,
              createdProductIds,
              createdOpportunityProductIds,
              createdRevenueScheduleIds,
              replacedScheduleIds,
              lineToScheduleMap: lineToScheduleMap as Prisma.InputJsonValue,
            },
          },
          select: { id: true },
        })

        await (tx as any).bundleOperation.update({
          where: { id: bundleOperation.id },
          data: {
            applyAuditLogId: bundleAudit.id,
            createdProductIds,
            createdOpportunityProductIds,
            createdRevenueScheduleIds,
            replacedRevenueScheduleIds: replacedScheduleIds,
            lineToScheduleMap: lineToScheduleMap as Prisma.InputJsonValue,
          },
        })

        const matchSchedules = matchScheduleIds.length
          ? await tx.revenueSchedule.findMany({
              where: { tenantId, id: { in: matchScheduleIds }, deletedAt: null } as any,
              include: {
              account: { select: { accountName: true, accountLegalName: true } },
              vendor: { select: { accountName: true } },
              product: { select: { productNameVendor: true, productNameHouse: true } },
            },
            orderBy: [{ scheduleDate: "asc" }, { createdAt: "asc" }],
          })
        : []

      const scheduleRows = buildScheduleRows(matchSchedules)

      return {
        bundleAuditLogId: bundleAudit.id,
        scheduleRows,
        lineToScheduleMap,
        createdRevenueScheduleIds,
        replacedScheduleIds,
        replacementMode: mode,
        mixedRateReplacement: rateAnalysis.hasMixedRates,
      }
      })

      return NextResponse.json({ data: result })
    } catch (error: any) {
      if (error instanceof BundleApplyError) {
        return NextResponse.json({ error: error.message, details: error.details }, { status: error.status })
      }

      if (error?.code === "P2002") {
        try {
          const existingOperation = await (prisma as any).bundleOperation.findFirst({
            where: { tenantId, idempotencyKey, undoneAt: null },
            select: {
              id: true,
              applyAuditLogId: true,
              createdRevenueScheduleIds: true,
              replacedRevenueScheduleIds: true,
              lineToScheduleMap: true,
              mode: true,
            },
          })
          if (existingOperation) {
            const result = await buildBundleApplyResponseFromOperation(prisma, { tenantId, operation: existingOperation })
            return NextResponse.json({ data: result })
          }
        } catch (lookupError) {
          console.error("Failed to resolve idempotent bundle response", lookupError)
        }

        return NextResponse.json({ error: "Duplicate bundle request" }, { status: 409 })
      }

      console.error("Failed to apply bundle rip/replace operation", error)
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Failed to create bundle schedules" },
        { status: 500 },
      )
    }
  })
}
