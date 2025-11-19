import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { withPermissions, createErrorResponse } from '@/lib/api-auth'
import { ReconciliationStatus, DepositPaymentType } from '@prisma/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function mapDeposit(deposit: any) {
  return {
    id: deposit.id,
    accountId: deposit.accountId,
    accountName: deposit.account?.accountName ?? '',
    month: deposit.month,
    totalRevenue: deposit.totalRevenue,
    totalCommissions: deposit.totalCommissions,
    status: deposit.status,
    reconciled: deposit.reconciled,
    reconciledAt: deposit.reconciledAt,
    depositName: deposit.depositName ?? '',
    paymentDate: deposit.paymentDate,
    paymentType: deposit.paymentType,
    totalItems: deposit.totalItems ?? 0,
    totalReconciledItems: deposit.totalReconciledItems ?? 0,
    totalUsage: deposit.totalUsage,
    usageAllocated: deposit.usageAllocated,
    usageUnallocated: deposit.usageUnallocated,
    commissionAllocated: deposit.commissionAllocated,
    commissionUnallocated: deposit.commissionUnallocated,
    itemsReconciled: deposit.itemsReconciled ?? 0,
    itemsUnreconciled: deposit.itemsUnreconciled ?? 0,
    distributorAccountId: deposit.distributorAccountId,
    distributorName: deposit.distributor?.accountName ?? '',
    vendorAccountId: deposit.vendorAccountId,
    vendorName: deposit.vendor?.accountName ?? '',
    createdByUserId: deposit.createdByUserId,
    createdByUserName: deposit.createdByUser?.fullName ?? '',
    createdByContactId: deposit.createdByContactId,
    createdByContactName: deposit.createdByContact
      ? `${deposit.createdByContact.firstName ?? ''} ${deposit.createdByContact.lastName ?? ''}`.trim()
      : '',
    createdAt: deposit.createdAt,
    updatedAt: deposit.updatedAt,
  }
}

export async function GET(request: NextRequest) {
  return withPermissions(
    request,
    ['reconciliation.view'],
    async (req) => {
      const tenantId = req.user.tenantId
      const searchParams = request.nextUrl.searchParams

      const page = Math.max(Number(searchParams.get('page') ?? '1'), 1)
      const pageSizeRaw = Number(searchParams.get('pageSize') ?? '25')
      const pageSize = Math.min(Math.max(pageSizeRaw, 1), 100)
      const status = searchParams.get('status')
      const paymentType = searchParams.get('paymentType')
      const distributorAccountId = searchParams.get('distributorAccountId')
      const vendorAccountId = searchParams.get('vendorAccountId')
      const from = searchParams.get('from')
      const to = searchParams.get('to')
      const q = searchParams.get('q')?.trim() ?? ''

      const where: any = { tenantId }

      if (status && status !== 'all') {
        if (!Object.values(ReconciliationStatus).includes(status as ReconciliationStatus)) {
          return createErrorResponse('Invalid status filter', 400)
        }
        where.status = status as ReconciliationStatus
      }

      if (paymentType) {
        if (!Object.values(DepositPaymentType).includes(paymentType as DepositPaymentType)) {
          return createErrorResponse('Invalid payment type filter', 400)
        }
        where.paymentType = paymentType as DepositPaymentType
      }

      if (distributorAccountId) {
        where.distributorAccountId = distributorAccountId
      }

      if (vendorAccountId) {
        where.vendorAccountId = vendorAccountId
      }

      if (from || to) {
        where.paymentDate = {}
        if (from) {
          where.paymentDate.gte = new Date(from)
        }
        if (to) {
          where.paymentDate.lte = new Date(to)
        }
      }

      if (q.length > 0) {
        where.OR = [
          { depositName: { contains: q, mode: 'insensitive' } },
          { account: { accountName: { contains: q, mode: 'insensitive' } } },
          { distributor: { accountName: { contains: q, mode: 'insensitive' } } },
          { vendor: { accountName: { contains: q, mode: 'insensitive' } } },
        ]
      }

      const skip = (page - 1) * pageSize

      const [total, deposits] = await Promise.all([
        prisma.deposit.count({ where }),
        prisma.deposit.findMany({
          where,
          include: {
            account: { select: { accountName: true } },
            distributor: { select: { accountName: true } },
            vendor: { select: { accountName: true } },
            createdByUser: { select: { fullName: true } },
            createdByContact: { select: { firstName: true, lastName: true } },
          },
          orderBy: [
            { paymentDate: 'desc' },
            { createdAt: 'desc' },
          ],
          skip,
          take: pageSize,
        }),
      ])

      return NextResponse.json({
        data: deposits.map(mapDeposit),
        pagination: {
          page,
          pageSize,
          total,
        },
      })
    }
  )
}

