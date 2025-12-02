import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { withPermissions } from "@/lib/api-auth"
import type { AuthenticatedRequest } from "@/lib/api-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  return withPermissions(
    request,
    ["opportunities.create", "opportunities.edit.all", "opportunities.manage"],
    async (req: AuthenticatedRequest) => {
      try {
        const tenantId = req.user?.tenantId

        if (!tenantId) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const query = searchParams.get("q") ?? ""
        const limit = 20

        // Search Accounts
        const accounts = await prisma.account.findMany({
          where: {
            tenantId,
            accountName: {
              contains: query,
              mode: "insensitive"
            }
          },
          select: {
            id: true,
            accountName: true,
            accountLegalName: true
          },
          take: Math.floor(limit / 2),
          orderBy: { accountName: "asc" }
        })

        // Search Contacts
        const contacts = await prisma.contact.findMany({
          where: {
            tenantId,
            deletedAt: null,
            OR: [
              { firstName: { contains: query, mode: "insensitive" } },
              { lastName: { contains: query, mode: "insensitive" } },
              { fullName: { contains: query, mode: "insensitive" } }
            ]
          },
          select: {
            id: true,
            fullName: true,
            account: {
              select: {
                accountName: true
              }
            }
          },
          take: Math.floor(limit / 2),
          orderBy: { fullName: "asc" }
        })

        const results = [
          ...accounts.map((a: any) => ({
            value: a.accountName,
            label: a.accountLegalName || a.accountName,
            type: "account" as const
          })),
          ...contacts.map((c: any) => ({
            value: c.fullName,
            label: `${c.fullName}${c.account?.accountName ? ` (${c.account.accountName})` : ""}`,
            type: "contact" as const
          }))
        ]

        return NextResponse.json({ data: results })
      } catch (error) {
        console.error("Error fetching referred by options:", error)
        return NextResponse.json(
          { error: "Failed to fetch referral options" },
          { status: 500 }
        )
      }
    }
  )
}
