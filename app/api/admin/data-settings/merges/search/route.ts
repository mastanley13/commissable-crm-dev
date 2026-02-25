import { NextRequest, NextResponse } from "next/server"
import { createErrorResponse, withPermissions } from "@/lib/api-auth"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MERGE_PERMISSIONS = ["admin.data_settings.merge"]

export async function GET(request: NextRequest) {
  return withPermissions(request, MERGE_PERMISSIONS, async req => {
    try {
      const searchParams = request.nextUrl.searchParams
      const entity = searchParams.get("entity")?.trim() ?? ""
      const q = searchParams.get("q")?.trim() ?? ""
      const tenantId = req.user.tenantId

      if (entity !== "Account" && entity !== "Contact") {
        return createErrorResponse("Invalid entity type.", 400)
      }

      if (q.length < 2) {
        return NextResponse.json({ data: [] })
      }

      if (entity === "Account") {
        const accounts = await prisma.account.findMany({
          where: {
            tenantId,
            mergedIntoAccountId: null,
            OR: [
              { accountName: { contains: q, mode: "insensitive" } },
              { accountLegalName: { contains: q, mode: "insensitive" } },
            ],
          },
          select: { id: true, accountName: true, accountLegalName: true },
          take: 10,
          orderBy: { accountName: "asc" },
        })

        return NextResponse.json({
          data: accounts.map(account => ({
            id: account.id,
            label: account.accountName,
            subtitle: account.accountLegalName ? `Legal: ${account.accountLegalName}` : undefined,
          })),
        })
      }

      const contacts = await prisma.contact.findMany({
        where: {
          tenantId,
          deletedAt: null,
          mergedIntoContactId: null,
          OR: [
            { fullName: { contains: q, mode: "insensitive" } },
            { emailAddress: { contains: q, mode: "insensitive" } },
          ],
        },
        select: { id: true, fullName: true, emailAddress: true },
        take: 10,
        orderBy: { fullName: "asc" },
      })

      return NextResponse.json({
        data: contacts.map(contact => ({
          id: contact.id,
          label: contact.fullName,
          subtitle: contact.emailAddress ? `Email: ${contact.emailAddress}` : undefined,
        })),
      })
    } catch (error) {
      console.error("Merge search failed", error)
      return createErrorResponse("Failed to search records.", 500)
    }
  })
}

