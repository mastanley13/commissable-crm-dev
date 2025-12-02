import { NextRequest, NextResponse } from "next/server"
import { DepositLineItemStatus } from "@prisma/client"
import { prisma } from "@/lib/db"
import { withPermissions, createErrorResponse } from "@/lib/api-auth"

const LINE_STATUS_LABEL: Record<DepositLineItemStatus, string> = {
  [DepositLineItemStatus.Unmatched]: "Unreconciled",
  [DepositLineItemStatus.Suggested]: "Unreconciled",
  [DepositLineItemStatus.Matched]: "Matched",
  [DepositLineItemStatus.PartiallyMatched]: "Partially Matched",
  [DepositLineItemStatus.Ignored]: "Unreconciled",
}

function mapDepositMetadata(deposit: any) {
  const createdByUser = deposit.createdByUser?.fullName
  const createdByContact = deposit.createdByContact
    ? `${deposit.createdByContact.firstName ?? ""} ${deposit.createdByContact.lastName ?? ""}`.trim()
    : ""

  const usageTotal = Number(deposit.totalUsage ?? deposit.usageAllocated ?? 0)
  const allocated = Number(deposit.usageAllocated ?? 0)
  const unallocated = Number(deposit.usageUnallocated ?? Math.max(usageTotal - allocated, 0))

  return {
    id: deposit.id,
    depositName: deposit.depositName ?? deposit.id,
    depositDate: deposit.paymentDate?.toISOString() ?? deposit.month?.toISOString() ?? new Date().toISOString(),
    createdBy: createdByUser || createdByContact || "",
    paymentType: deposit.paymentType ?? "ACH",
    usageTotal,
    unallocated,
    allocated,
  }
}

function mapDepositLineItem(deposit: any, line: any, index: number) {
  return {
    id: line.id,
    status: LINE_STATUS_LABEL[line.status as DepositLineItemStatus] ?? "Unreconciled",
    paymentDate: line.paymentDate?.toISOString() ?? "",
    accountName: line.accountNameRaw ?? line.account?.accountName ?? "Unknown Account",
    vendorName: line.vendorNameRaw ?? line.vendorAccount?.accountName ?? deposit.vendor?.accountName ?? "Unknown Vendor",
    lineItem: line.lineNumber ?? index + 1,
    productName: line.productNameRaw ?? line.product?.productNameVendor ?? "Unknown Product",
    usage: Number(line.usage ?? 0),
    usageAllocated: Number(line.usageAllocated ?? 0),
    usageUnallocated: Number(line.usageUnallocated ?? 0),
    commission: Number(line.commission ?? 0),
    commissionAllocated: Number(line.commissionAllocated ?? 0),
    commissionUnallocated: Number(line.commissionUnallocated ?? 0),
    commissionRate: Number(line.commissionRate ?? 0),
    accountId: line.accountIdVendor ?? line.accountId ?? "",
    customerIdVendor: line.customerIdVendor ?? "",
    orderIdVendor: line.orderIdVendor ?? "",
    distributorName: line.distributorNameRaw ?? deposit.distributor?.accountName ?? "",
  }
}

export async function GET(request: NextRequest, { params }: { params: { depositId: string } }) {
  return withPermissions(request, ["reconciliation.view"], async (req) => {
    const depositId = params?.depositId?.trim()
    const tenantId = req.user.tenantId

    if (!depositId) {
      return createErrorResponse("Deposit id is required", 400)
    }

    const deposit = await prisma.deposit.findFirst({
      where: { id: depositId, tenantId },
      include: {
        distributor: { select: { accountName: true } },
        vendor: { select: { accountName: true } },
        createdByUser: { select: { fullName: true } },
        createdByContact: { select: { firstName: true, lastName: true } },
        lineItems: {
          include: {
            account: { select: { accountName: true } },
            vendorAccount: { select: { accountName: true } },
            product: { select: { productNameVendor: true } },
          },
          orderBy: [{ lineNumber: "asc" }, { createdAt: "asc" }],
        },
      },
    })

    if (!deposit) {
      return createErrorResponse("Deposit not found", 404)
    }

    const metadata = mapDepositMetadata(deposit)
    const lineItems = (deposit.lineItems ?? []).map((line: any, index: number) => mapDepositLineItem(deposit, line, index))

    return NextResponse.json({
      data: {
        metadata,
        lineItems,
      },
    })
  })
}
