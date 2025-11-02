import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { withAuth } from "@/lib/api-auth"
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { pageKey: string } }
) {
  return withAuth(request, async (req) => {
    try {
      const { pageKey } = params
      const tenantId = req.user.tenantId
      const userId = req.user.id

      const preference = await prisma.tablePreference.findUnique({
        where: {
          userId_pageKey: {
            userId,
            pageKey
          }
        }
      })

      if (!preference) {
        return NextResponse.json(null)
      }

      return NextResponse.json({
        columnOrder: preference.columnOrder ?? null,
        columnWidths: preference.columnWidths ?? null,
        hiddenColumns: preference.hiddenColumns ?? null,
        sortState: preference.sortState ?? null,
        filters: preference.filters ?? null,
        meta: {
          tenantId,
          userId
        }
      })
    } catch (error) {
      console.error("Failed to load table preferences", error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      const errorStack = error instanceof Error ? error.stack : undefined
      console.error("Error details:", { errorMessage, errorStack })
      return NextResponse.json({ 
        error: "Failed to load table preferences",
        details: errorMessage 
      }, { status: 500 })
    }
  })
}

export async function POST(
  request: NextRequest,
  { params }: { params: { pageKey: string } }
) {
  return withAuth(request, async (req) => {
    try {
      const { pageKey } = params
      const tenantId = req.user.tenantId
      const userId = req.user.id
      const body = await request.json()

      const columnOrder = Array.isArray(body.columnOrder) ? body.columnOrder : null
      const columnWidths = body.columnWidths && typeof body.columnWidths === "object" ? body.columnWidths : null
      const hiddenColumns = Array.isArray(body.hiddenColumns) ? body.hiddenColumns : null

      await prisma.tablePreference.upsert({
        where: {
          userId_pageKey: {
            userId,
            pageKey
          }
        },
        update: {
          tenantId,
          columnOrder,
          columnWidths,
          hiddenColumns,
          sortState: body.sortState ?? null,
          filters: body.filters ?? null
        },
        create: {
          tenantId,
          userId,
          pageKey,
          columnOrder,
          columnWidths,
          hiddenColumns,
          sortState: body.sortState ?? null,
          filters: body.filters ?? null
        }
      })

      return NextResponse.json({ success: true })
    } catch (error) {
      console.error("Failed to save table preferences", error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      const errorStack = error instanceof Error ? error.stack : undefined
      console.error("Error details:", { errorMessage, errorStack })
      return NextResponse.json({ 
        error: "Failed to save table preferences",
        details: errorMessage 
      }, { status: 500 })
    }
  })
}

