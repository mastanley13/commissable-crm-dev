import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { withAuth } from "@/lib/api-auth"
import { Prisma } from "@prisma/client"
import { aliasColumnId, migrateTablePreferencePayload } from "@/lib/table-preferences-alias"
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic';

function normalizePageSize(value: unknown): number | null {
  const num = Number(value)
  if (!Number.isFinite(num)) {
    return null
  }
  const clamped = Math.min(100, Math.max(1, Math.floor(num)))
  return clamped
}

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

      const payload = {
        columnOrder: preference.columnOrder ?? null,
        columnWidths: preference.columnWidths ?? null,
        hiddenColumns: preference.hiddenColumns ?? null,
        sortState: preference.sortState ?? null,
        filters: preference.filters ?? null,
        pageSize: preference.pageSize ?? null,
        meta: {
          tenantId,
          userId
        }
      }

      return NextResponse.json(migrateTablePreferencePayload(payload))
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

      const columnOrder = Array.isArray(body.columnOrder)
        ? body.columnOrder.map((id: unknown) => (typeof id === "string" ? aliasColumnId(id) : "")).filter(Boolean)
        : null
      const hiddenColumns = Array.isArray(body.hiddenColumns)
        ? body.hiddenColumns.map((id: unknown) => (typeof id === "string" ? aliasColumnId(id) : "")).filter(Boolean)
        : null

      const columnWidths: Record<string, number> | null =
        body.columnWidths && typeof body.columnWidths === "object" && !Array.isArray(body.columnWidths)
          ? Object.fromEntries(
              Object.entries(body.columnWidths)
                .map(([key, value]) => [aliasColumnId(key), value] as const)
                .filter((entry): entry is readonly [string, number] => {
                  const [, value] = entry
                  return typeof value === "number" && Number.isFinite(value) && value > 0
                })
            )
          : null

      const hasPageSize = Object.prototype.hasOwnProperty.call(body, "pageSize")
      const pageSize = hasPageSize ? normalizePageSize(body.pageSize) : undefined

      const migrated = migrateTablePreferencePayload({
        sortState: body.sortState ?? null,
        filters: body.filters ?? null
      }) as any

      const columnOrderJson: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput = columnOrder ?? Prisma.DbNull
      const columnWidthsJson: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput = columnWidths ?? Prisma.DbNull
      const hiddenColumnsJson: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput = hiddenColumns ?? Prisma.DbNull
      const sortStateJson: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput =
        ((migrated?.sortState ?? body.sortState) as Prisma.InputJsonValue | null | undefined) ?? Prisma.DbNull
      const filtersJson: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput =
        ((migrated?.filters ?? body.filters) as Prisma.InputJsonValue | null | undefined) ?? Prisma.DbNull

      await prisma.tablePreference.upsert({
        where: {
          userId_pageKey: {
            userId,
            pageKey
          }
        },
        update: {
          tenantId,
          columnOrder: columnOrderJson,
          columnWidths: columnWidthsJson,
          hiddenColumns: hiddenColumnsJson,
          sortState: sortStateJson,
          filters: filtersJson,
          ...(hasPageSize ? { pageSize } : {})
        },
        create: {
          tenantId,
          userId,
          pageKey,
          columnOrder: columnOrderJson,
          columnWidths: columnWidthsJson,
          hiddenColumns: hiddenColumnsJson,
          sortState: sortStateJson,
          filters: filtersJson,
          ...(hasPageSize ? { pageSize } : {})
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

