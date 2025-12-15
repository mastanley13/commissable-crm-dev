import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { getPrisma } from "@/lib/db"
import { withPermissions } from "@/lib/api-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const AUDIT_LOG_VIEW_PERMISSIONS = [
  "auditLogs.read",
  "auditLogs.manage",
  "opportunities.manage",
  "activities.manage",
  "accounts.manage"
]

export async function GET(request: NextRequest) {
  return withPermissions(request, AUDIT_LOG_VIEW_PERMISSIONS, async req => {
    const searchParams = request.nextUrl.searchParams
    const entityName = searchParams.get("entityName")
    const entityId = searchParams.get("entityId")
    const entityIdsParam = searchParams.get("entityIds")

    if (!entityName) {
      return NextResponse.json({ error: "entityName is required" }, { status: 400 })
    }

    let entityIds: string[] | undefined
    if (entityIdsParam) {
      entityIds = entityIdsParam
        .split(",")
        .map(id => id.trim())
        .filter(Boolean)
    }

    if (!entityId && (!entityIds || entityIds.length === 0)) {
      return NextResponse.json({ error: "entityId or entityIds is required" }, { status: 400 })
    }

    const page = Math.max(1, Number(searchParams.get("page") ?? "1"))
    const pageSize = Math.min(200, Math.max(1, Number(searchParams.get("pageSize") ?? "50")))
    const summaryOnlyParam = searchParams.get("summaryOnly")
    const summaryOnly = summaryOnlyParam === "true" || summaryOnlyParam === "1"

    const where: Prisma.AuditLogWhereInput = {
      tenantId: req.user.tenantId,
      entityName
    }

    if (entityIds && entityIds.length > 0) {
      where.entityId = { in: entityIds }
    } else if (entityId) {
      where.entityId = entityId
    }

    try {
      const client = await getPrisma()

      const [logs, total] = await client.$transaction([
        client.auditLog.findMany({
          where,
          include: {
            user: { select: { id: true, fullName: true, email: true } }
          },
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize
        }),
        client.auditLog.count({ where })
      ])

      return NextResponse.json({
        data: logs.map(log => {
          // Parse JSON fields if they're strings (shouldn't happen with Prisma, but just in case)
          const parseJsonField = (field: any) => {
            if (field === null || field === undefined) return null
            if (typeof field === "string") {
              try {
                return JSON.parse(field)
              } catch {
                return field
              }
            }
            return field
          }

          const changedFields = parseJsonField(log.changedFields)

          const base = {
            id: log.id,
            entityName: log.entityName,
            entityId: log.entityId,
            action: log.action,
            createdAt: log.createdAt.toISOString(),
            userId: log.userId,
            userName: log.user?.fullName ?? log.user?.email ?? null,
            changedFields
          }

          if (summaryOnly) {
            return base
          }

          return {
            ...base,
            previousValues: parseJsonField(log.previousValues),
            newValues: parseJsonField(log.newValues),
            metadata: parseJsonField(log.metadata)
          }
        }),
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.max(1, Math.ceil(total / pageSize))
        }
      })
    } catch (error) {
      console.error("Failed to load audit logs", error)
      console.error("Error details:", error instanceof Error ? error.message : String(error))
      console.error("Error stack:", error instanceof Error ? error.stack : '')
      return NextResponse.json({ error: "Failed to load audit logs" }, { status: 500 })
    }
  })
}
