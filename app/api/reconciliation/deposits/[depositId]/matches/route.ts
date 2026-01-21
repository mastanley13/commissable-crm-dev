import { NextRequest, NextResponse } from "next/server"
import { DepositLineMatchStatus } from "@prisma/client"
import { withPermissions, createErrorResponse } from "@/lib/api-auth"
import { prisma } from "@/lib/db"

function toNumber(value: unknown) {
  const num = Number(value ?? 0)
  return Number.isFinite(num) ? num : 0
}

export async function GET(request: NextRequest, { params }: { params: { depositId: string } }) {
  return withPermissions(request, ["reconciliation.view"], async req => {
    try {
      const depositId = params?.depositId?.trim()
      const tenantId = req.user.tenantId

      if (!depositId) {
        return createErrorResponse("Deposit id is required", 400)
      }

      const statusParam = request.nextUrl.searchParams.get("status")
      const statusFilter =
        statusParam === "all" ? null : DepositLineMatchStatus.Applied

      const matches = await prisma.depositLineMatch.findMany({
        where: {
          tenantId,
          ...(statusFilter ? { status: statusFilter } : {}),
          depositLineItem: { depositId },
          revenueSchedule: {
            deletedAt: null,
          },
        },
        include: {
          depositLineItem: {
            select: {
              id: true,
              lineNumber: true,
              paymentDate: true,
              status: true,
              reconciled: true,
              accountNameRaw: true,
              productNameRaw: true,
              usage: true,
              commission: true,
              account: { select: { accountName: true } },
              product: { select: { productNameVendor: true } },
            },
          },
          revenueSchedule: {
            select: {
              id: true,
              scheduleNumber: true,
              scheduleDate: true,
              status: true,
              account: { select: { accountName: true, accountLegalName: true } },
              product: { select: { productNameVendor: true } },
              vendor: { select: { accountName: true } },
            },
          },
        },
        orderBy: [
          { depositLineItem: { lineNumber: "asc" } },
          { createdAt: "asc" },
        ],
      })

      const rows = matches.map(match => {
        const line = match.depositLineItem
        const schedule = match.revenueSchedule
        return {
          id: match.id,
          depositLineItemId: match.depositLineItemId,
          revenueScheduleId: match.revenueScheduleId,
          matchStatus: match.status,
          matchSource: match.source,
          confidenceScore: match.confidenceScore ?? null,
          reconciled: Boolean(match.reconciled),
          lineItem: line?.lineNumber ?? 0,
          paymentDate: line?.paymentDate?.toISOString?.() ?? "",
          accountName: line?.accountNameRaw ?? line?.account?.accountName ?? "Unknown Account",
          productName: line?.productNameRaw ?? line?.product?.productNameVendor ?? "Unknown Product",
          lineStatus: line?.status ?? null,
          lineReconciled: Boolean(line?.reconciled),
          scheduleNumber: schedule?.scheduleNumber ?? schedule?.id ?? "",
          scheduleDate: schedule?.scheduleDate?.toISOString?.() ?? "",
          scheduleStatus: schedule?.status ?? null,
          scheduleAccountName: schedule?.account?.accountLegalName ?? schedule?.account?.accountName ?? "",
          scheduleProductName: schedule?.product?.productNameVendor ?? "",
          scheduleVendorName: schedule?.vendor?.accountName ?? "",
          allocatedUsage: toNumber(match.usageAmount),
          allocatedCommission: toNumber(match.commissionAmount),
          lineUsage: toNumber(line?.usage),
          lineCommission: toNumber(line?.commission),
        }
      })

      return NextResponse.json({ data: rows })
    } catch (error) {
      console.error("Failed to load deposit matches", error)
      const message =
        process.env.NODE_ENV === "development" && error instanceof Error
          ? `Failed to load deposit matches: ${error.message}`
          : "Failed to load deposit matches"
      return createErrorResponse(message, 500)
    }
  })
}

