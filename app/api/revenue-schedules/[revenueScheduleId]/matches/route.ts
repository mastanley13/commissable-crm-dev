import { NextRequest, NextResponse } from "next/server"
import { DepositLineMatchStatus, DepositPaymentType } from "@prisma/client"

import { prisma } from "@/lib/db"
import { withAuth } from "@/lib/api-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function formatDepositPaymentType(value: DepositPaymentType | null | undefined): string | null {
  if (!value) return null
  switch (value) {
    case DepositPaymentType.ACH:
      return "Bank Transfer"
    case DepositPaymentType.Wire:
      return "Wire Transfer"
    case DepositPaymentType.Check:
      return "Check"
    case DepositPaymentType.CreditCard:
      return "Credit Card"
    case DepositPaymentType.Other:
      return "Other"
    default:
      return String(value)
  }
}

export async function GET(request: NextRequest, { params }: { params: { revenueScheduleId: string } }) {
  return withAuth(request, async req => {
    try {
      const { revenueScheduleId } = params
      if (!revenueScheduleId) {
        return NextResponse.json({ error: "Revenue schedule id is required" }, { status: 400 })
      }

      const tenantId = req.user.tenantId

      const matches = await prisma.depositLineMatch.findMany({
        where: {
          tenantId,
          revenueScheduleId,
          status: DepositLineMatchStatus.Applied
        },
        orderBy: [{ reconciledAt: "asc" }, { createdAt: "asc" }],
        include: {
          depositLineItem: {
            select: {
              id: true,
              paymentDate: true,
              usage: true,
              commission: true,
              deposit: {
                select: {
                  id: true,
                  depositName: true,
                  paymentDate: true,
                  paymentType: true
                }
              }
            }
          }
        }
      })

      const data = matches.map(match => {
        const line = match.depositLineItem
        const deposit = line?.deposit

        const parseNumber = (value: unknown): number | null => {
          if (value === null || value === undefined) return null
          const numeric = Number(value as number)
          return Number.isFinite(numeric) ? numeric : null
        }

        return {
          id: match.id,
          depositLineItemId: line?.id ?? null,
          depositId: deposit?.id ?? null,
          depositName: deposit?.depositName ?? null,
          depositPaymentDate: deposit?.paymentDate ? deposit.paymentDate.toISOString() : null,
          depositPaymentType: formatDepositPaymentType(deposit?.paymentType ?? null),
          linePaymentDate: line?.paymentDate ? line.paymentDate.toISOString() : null,
          reconciledAt: match.reconciledAt ? match.reconciledAt.toISOString() : null,
          usageAmount: parseNumber(line?.usage ?? match.usageAmount),
          commissionAmount: parseNumber(line?.commission ?? match.commissionAmount),
          metadata: null as Record<string, unknown> | null
        }
      })

      return NextResponse.json({ data })
    } catch (error) {
      console.error("Failed to load revenue schedule matches", error)
      return NextResponse.json({ error: "Failed to load matched deposits" }, { status: 500 })
    }
  })
}

