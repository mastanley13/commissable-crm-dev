import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { withPermissions } from "@/lib/api-auth"

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic';

const DEFAULT_LIMIT = 8

export async function GET(request: NextRequest) {
  return withPermissions(
    request,
    ['accounts.manage', 'accounts.read', 'contacts.manage', 'contacts.read'],
    async (req) => {
      try {
        const searchParams = request.nextUrl.searchParams
        const query = searchParams.get("q")?.trim() ?? ""
        const limitParam = Number(searchParams.get("limit") ?? DEFAULT_LIMIT)
        const limit = Number.isFinite(limitParam) ? Math.min(Math.max(Math.floor(limitParam), 1), 20) : DEFAULT_LIMIT

        if (query.length === 0) {
          return NextResponse.json({ suggestions: [] })
        }

        const tenantId = req.user.tenantId
        const sliceSize = Math.max(1, Math.ceil(limit / 2))

        const [accounts, contacts] = await Promise.all([
          prisma.account.findMany({
            where: {
              tenantId,
              OR: [
                { accountName: { contains: query, mode: "insensitive" } },
                { accountLegalName: { contains: query, mode: "insensitive" } }
              ]
            },
            select: {
              id: true,
              accountName: true,
              accountType: { select: { name: true } }
            },
            take: sliceSize
          }),
          prisma.contact.findMany({
            where: {
              tenantId,
              OR: [
                { fullName: { contains: query, mode: "insensitive" } },
                { emailAddress: { contains: query, mode: "insensitive" } }
              ]
            },
            select: {
              id: true,
              fullName: true,
              account: { select: { accountName: true } },
              accountType: { select: { name: true } }
            },
            take: sliceSize
          })
        ])

        const suggestions = [
          ...accounts.map(account => ({
            id: account.id,
            type: "Account" as const,
            title: account.accountName,
            subtitle: account.accountType?.name ?? "",
            href: `/accounts/${account.id}`
          })),
          ...contacts.map(contact => ({
            id: contact.id,
            type: "Contact" as const,
            title: contact.fullName,
            subtitle: contact.account?.accountName ?? contact.accountType?.name ?? "",
            href: `/contacts/${contact.id}`
          }))
        ]
          .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }))
          .slice(0, limit)

        return NextResponse.json({ suggestions })
      } catch (error) {
        console.error("Global search failed", error)
        return NextResponse.json({ error: "Failed to fetch search suggestions" }, { status: 500 })
      }
    }
  )
}
