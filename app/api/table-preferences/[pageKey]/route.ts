import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { resolveTenantId, resolveUserId } from "@/lib/server-utils"
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { pageKey: string } }
) {
  try {
    const searchParams = request.nextUrl.searchParams
    const tenantId = await resolveTenantId(searchParams.get("tenantId"))
    const userId = await resolveUserId(tenantId, searchParams.get("userId"))

    const preference = await prisma.tablePreference.findUnique({
      where: {
        userId_pageKey: {
          userId,
          pageKey: params.pageKey
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
    return NextResponse.json({ error: "Failed to load table preferences" }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { pageKey: string } }
) {
  try {
    const searchParams = request.nextUrl.searchParams
    const tenantId = await resolveTenantId(searchParams.get("tenantId"))
    const body = await request.json()
    const userId = await resolveUserId(tenantId, body.userId ?? null)

    const columnOrder = Array.isArray(body.columnOrder) ? body.columnOrder : null
    const columnWidths = body.columnWidths && typeof body.columnWidths === "object" ? body.columnWidths : null
    const hiddenColumns = Array.isArray(body.hiddenColumns) ? body.hiddenColumns : null

    await prisma.tablePreference.upsert({
      where: {
        userId_pageKey: {
          userId,
          pageKey: params.pageKey
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
        pageKey: params.pageKey,
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
    return NextResponse.json({ error: "Failed to save table preferences" }, { status: 500 })
  }
}

