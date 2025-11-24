import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { withPermissions } from "@/lib/api-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface AccountSummaryRequest {
  accountIds: string[]
}

export async function POST(request: NextRequest) {
  return withPermissions(
    request,
    ["accounts.reassign", "accounts.bulk"],
    async (req) => {
      const body = (await request.json().catch(() => null)) as AccountSummaryRequest | null

      if (!body || !Array.isArray(body.accountIds) || body.accountIds.length === 0) {
        return NextResponse.json(
          { error: "Account IDs are required" },
          { status: 400 }
        )
      }

      const accounts = await prisma.account.findMany({
        where: {
          tenantId: req.user.tenantId,
          id: { in: body.accountIds }
        },
        select: {
          id: true,
          accountName: true,
          accountLegalName: true,
          status: true,
          accountType: { select: { name: true } },
          owner: { select: { fullName: true } }
        }
      })

      return NextResponse.json({
        accounts: accounts.map(account => ({
          id: account.id,
          accountName: account.accountName,
          accountLegalName: account.accountLegalName ?? "",
          accountType: account.accountType?.name ?? "",
          accountOwner: account.owner?.fullName ?? null,
          status: account.status
        }))
      })
    }
  )
}

