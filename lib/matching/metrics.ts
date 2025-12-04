import { AuditAction } from "@prisma/client"
import { logAudit, getClientIP, getUserAgent } from "@/lib/audit"

type MatchingMetricEvent = "manual_match" | "auto_match" | "finalize" | "unfinalize"

interface MatchingMetricParams {
  tenantId: string
  userId: string
  event: MatchingMetricEvent
  depositId: string
  lineItemId?: string
  scheduleId?: string
  confidence?: number
  matchType?: string
  source?: string
  request?: Request
  metadata?: Record<string, unknown>
}

export async function logMatchingMetric(params: MatchingMetricParams) {
  try {
    await logAudit({
      userId: params.userId,
      tenantId: params.tenantId,
      action: AuditAction.Update,
      entityName: "Reconciliation",
      entityId: params.depositId,
      ipAddress: params.request ? getClientIP(params.request) : undefined,
      userAgent: params.request ? getUserAgent(params.request) : undefined,
      metadata: {
        event: params.event,
        depositId: params.depositId,
        lineItemId: params.lineItemId,
        scheduleId: params.scheduleId,
        confidence: params.confidence,
        matchType: params.matchType,
        source: params.source,
        ...params.metadata,
      },
    })
  } catch (error) {
    console.error("Failed to log matching metric", error)
  }
}
