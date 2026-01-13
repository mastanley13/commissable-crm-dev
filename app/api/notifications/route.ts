import { NextRequest, NextResponse } from "next/server"
import { withAuth, createErrorResponse } from "@/lib/api-auth"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"

interface MarkReadRequestBody {
  notificationIds?: string[]
  markAll?: boolean
}

export async function GET(request: NextRequest) {
  return withAuth(request, async req => {
    try {
      const tenantId = req.user.tenantId
      const userId = req.user.id
      const includeRead = request.nextUrl.searchParams.get("includeRead") === "true"

      const notifications = await prisma.notification.findMany({
        where: {
          tenantId,
          userId,
          ...(includeRead ? {} : { readAt: null }),
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      })

      return NextResponse.json({
        data: notifications.map(n => ({
          id: n.id,
          title: n.title,
          body: n.body ?? null,
          readAt: n.readAt?.toISOString() ?? null,
          createdAt: n.createdAt.toISOString(),
          metadata: (n.metadata ?? null) as any,
        })),
      })
    } catch (error) {
      console.error("Failed to load notifications", error)
      return createErrorResponse(error instanceof Error ? error.message : "Failed to load notifications", 500)
    }
  })
}

export async function POST(request: NextRequest) {
  return withAuth(request, async req => {
    try {
      const tenantId = req.user.tenantId
      const userId = req.user.id
      const body = (await request.json().catch(() => null)) as MarkReadRequestBody | null

      const markAll = Boolean(body?.markAll)
      const ids = Array.isArray(body?.notificationIds)
        ? body!.notificationIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
        : []

      if (!markAll && ids.length === 0) {
        return createErrorResponse("notificationIds or markAll is required", 400)
      }

      const where = {
        tenantId,
        userId,
        ...(markAll ? {} : { id: { in: ids } }),
      } as any

      const result = await prisma.notification.updateMany({
        where,
        data: { readAt: new Date() },
      })

      return NextResponse.json({ data: { updatedCount: result.count } })
    } catch (error) {
      console.error("Failed to mark notifications as read", error)
      return createErrorResponse(error instanceof Error ? error.message : "Failed to mark notifications as read", 500)
    }
  })
}
