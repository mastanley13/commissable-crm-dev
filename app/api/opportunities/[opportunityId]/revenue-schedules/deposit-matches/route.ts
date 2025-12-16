import { NextRequest, NextResponse } from "next/server"
import { DepositLineMatchStatus } from "@prisma/client"

import { prisma } from "@/lib/db"
import { withPermissions } from "@/lib/api-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const DEPOSIT_MATCHES_PERMISSIONS = ["revenue-schedules.manage", "opportunities.manage"]

export async function GET(
  request: NextRequest,
  { params }: { params: { opportunityId: string } },
) {
  return withPermissions(request, DEPOSIT_MATCHES_PERMISSIONS, async req => {
    try {
      const { opportunityId } = params
      if (!opportunityId) {
        return NextResponse.json(
          { error: "Opportunity id is required" },
          { status: 400 },
        )
      }

      const tenantId = req.user.tenantId

      const matches = await prisma.depositLineMatch.findMany({
        where: {
          tenantId,
          status: DepositLineMatchStatus.Applied,
          revenueSchedule: {
            opportunityId,
          },
        },
        select: {
          id: true,
          revenueScheduleId: true,
          commissionAmount: true,
          revenueSchedule: {
            select: {
              scheduleNumber: true,
            },
          },
          depositLineItem: {
            select: {
              id: true,
              commission: true,
              paymentDate: true,
              depositId: true,
              deposit: {
                select: {
                  id: true,
                  depositName: true,
                  paymentDate: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      })

      const data = matches.map(match => {
        const deposit = match.depositLineItem?.deposit
        const depositId = deposit?.id ?? match.depositLineItem?.depositId ?? null

        const paymentDate =
          deposit?.paymentDate ?? match.depositLineItem?.paymentDate ?? null

        let depositDate: string | null = null
        if (paymentDate instanceof Date && !Number.isNaN(paymentDate.getTime())) {
          depositDate = paymentDate.toISOString().slice(0, 10)
        }

        const amountSource =
          match.commissionAmount ??
          match.depositLineItem?.commission ??
          null

        const amount =
          amountSource !== null && amountSource !== undefined
            ? Number(amountSource)
            : null

        return {
          id: match.id,
          scheduleId: match.revenueScheduleId,
          scheduleNumber: match.revenueSchedule?.scheduleNumber ?? null,
          depositId,
          depositReference: deposit?.depositName ?? null,
          depositDate,
          amount,
        }
      })

      return NextResponse.json({ data })
    } catch (error) {
      console.error("Failed to load deposit matches for opportunity", error)
      return NextResponse.json(
        { error: "Unable to load deposit matches" },
        { status: 500 },
      )
    }
  })
}

